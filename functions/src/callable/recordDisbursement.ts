import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { writeAudit } from '../lib/audit';
import { dispatchNotification } from '../lib/notify';
import type { PaymentMode } from '../lib/types';

const VALID_MODES = new Set<PaymentMode>(['cash', 'upi', 'cheque', 'bank']);

interface RecordDisbursementInput {
  requestId: string;
  amountPaise: number;
  accountId: string;
  kind: 'partial' | 'final';
  paymentMode: PaymentMode;
  referenceNo?: string;
  paidAt: string;  // "YYYY-MM-DD"
  notes?: string;
  invoiceRef?: string;  // Storage path for invoice document
}

export const recordDisbursement = onCall(
  { region: 'asia-south1' },
  async (request): Promise<{ ok: true; txnId: string; disbId: string }> => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Not signed in.');

    const token     = request.auth?.token as Record<string, unknown> | undefined;
    const societyId = token?.societyId as string | undefined;
    const role      = token?.role as string | undefined;

    if (!societyId) throw new HttpsError('failed-precondition', 'No active society.');
    if (role !== 'fm')
      throw new HttpsError('permission-denied', 'Only FM can record disbursements.');

    const input = request.data as RecordDisbursementInput;

    if (!input.requestId?.trim())
      throw new HttpsError('invalid-argument', 'requestId is required.');
    if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0)
      throw new HttpsError('invalid-argument', 'amountPaise must be a positive integer.');
    if (!input.accountId?.trim())
      throw new HttpsError('invalid-argument', 'accountId is required.');
    if (input.kind !== 'partial' && input.kind !== 'final')
      throw new HttpsError('invalid-argument', 'kind must be "partial" or "final".');
    if (!VALID_MODES.has(input.paymentMode))
      throw new HttpsError('invalid-argument', 'paymentMode must be cash, upi, cheque, or bank.');
    if (!input.paidAt?.match(/^\d{4}-\d{2}-\d{2}$/))
      throw new HttpsError('invalid-argument', 'paidAt must be "YYYY-MM-DD".');

    const requestRef = db.doc(`societies/${societyId}/expenseRequests/${input.requestId}`);
    const accountRef = db.doc(`societies/${societyId}/accounts/${input.accountId}`);

    // Pre-read account outside transaction (just for existence check — low-contention)
    const accountSnap = await accountRef.get();
    if (!accountSnap.exists)
      throw new HttpsError('not-found', 'Account not found.');

    // Pre-allocate IDs so we can return them after the transaction
    const txnRef  = db.collection(`societies/${societyId}/transactions`).doc();
    const disbRef = requestRef.collection('disbursements').doc();
    const txnId   = txnRef.id;
    const disbId  = disbRef.id;

    const paidAtTs = Timestamp.fromDate(new Date(`${input.paidAt}T00:00:00.000Z`));

    const { requestTitle } = await db.runTransaction(async txn => {
      const reqSnap = await txn.get(requestRef);
      if (!reqSnap.exists)
        throw new HttpsError('not-found', 'Expense request not found.');

      const data = reqSnap.data()!;

      if (data.societyId !== societyId)
        throw new HttpsError('permission-denied', 'Cross-society access denied.');

      // D9e spend gate — only approved or disbursed requests can receive disbursement
      if (data.status !== 'approved' && data.status !== 'disbursed')
        throw new HttpsError(
          'failed-precondition',
          `Cannot disburse: request is "${data.status}", must be "approved" or "disbursed".`,
        );

      // D9a spend cap — cumulative disbursements must not exceed approvedAmountPaise
      const approvedAmount  = data.approvedAmountPaise as number;
      const alreadyDisbursed = (data.disbursedAmountPaise as number | undefined) ?? 0;
      const newTotal         = alreadyDisbursed + input.amountPaise;

      if (newTotal > approvedAmount)
        throw new HttpsError(
          'failed-precondition',
          `Disbursement would exceed approved amount. ` +
          `Approved: ${approvedAmount} paise, already disbursed: ${alreadyDisbursed} paise, ` +
          `requested: ${input.amountPaise} paise.`,
        );

      // Write transaction doc (triggers recomputeBalances)
      const txnData: Record<string, unknown> = {
        id: txnId,
        societyId,
        direction: 'out',
        amountPaise: input.amountPaise,
        accountId: input.accountId,
        fundHead: data.fundHead,
        mode: input.paymentMode,
        description: `Disbursement: ${data.title as string}`,
        occurredAt: paidAtTs,
        sourceType: 'expenseRequest',
        sourceId: input.requestId,
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
      };
      if (input.referenceNo?.trim()) txnData.referenceNo = input.referenceNo.trim();
      if (input.notes?.trim()) txnData.notes = input.notes.trim();

      txn.set(txnRef, txnData);

      // Write disbursement subdoc
      const disbData: Record<string, unknown> = {
        id: disbId,
        societyId,
        requestId: input.requestId,
        amountPaise: input.amountPaise,
        txnId,
        kind: input.kind,
        paidAt: paidAtTs,
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
      };
      if (input.invoiceRef?.trim()) disbData.invoiceRef = input.invoiceRef.trim();

      txn.set(disbRef, disbData);

      // Update request: increment disbursedAmountPaise, set status to 'disbursed'
      txn.update(requestRef, {
        disbursedAmountPaise: newTotal,
        status: 'disbursed',
      });

      return { requestTitle: data.title as string };
    });

    await writeAudit({
      societyId,
      actorUid:  uid,
      actorRole: role,
      action:    'expense_request_disbursed',
      targetType: 'expenseRequest',
      targetId:   input.requestId,
      after: {
        disbursedAmountPaise: input.amountPaise,
        kind: input.kind,
        txnId,
      },
    });

    void dispatchNotification({
      societyId,
      type: 'expense_request_disbursed',
      toRole: 'admin',
      payload: { requestId: input.requestId, title: requestTitle, amountPaise: input.amountPaise },
    }).catch(e => console.error('notify error:', e));

    return { ok: true, txnId, disbId };
  },
);
