import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { writeAudit } from '../lib/audit';
import { dispatchNotification } from '../lib/notify';
import { fetchApprovalTiers, resolveTier, getActiveMCCount } from '../lib/tierHelpers';
import type { Quotation } from '../lib/types';

interface QuotationInput {
  vendorId: string;
  amountPaise: number;
  scopeNotes: string;
  documentRef?: string;
}

interface SubmitExpenseRequestInput {
  requestId: string;
  quotations: QuotationInput[]; // required for snag take-up
}

export const submitExpenseRequest = onCall(
  { region: 'asia-south1' },
  async (request): Promise<{ ok: true }> => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Not signed in.');

    const token     = request.auth?.token as Record<string, unknown> | undefined;
    const societyId = token?.societyId as string | undefined;
    const role      = token?.role as string | undefined;

    if (!societyId) throw new HttpsError('failed-precondition', 'No active society.');
    if (role !== 'fm')
      throw new HttpsError('permission-denied', 'Only FM can take up a request.');

    const input = request.data as SubmitExpenseRequestInput;

    if (!input.requestId?.trim())
      throw new HttpsError('invalid-argument', 'requestId is required.');
    if (!Array.isArray(input.quotations) || input.quotations.length === 0)
      throw new HttpsError('invalid-argument', 'At least one quotation is required.');
    for (const q of input.quotations) {
      if (!q.vendorId?.trim())
        throw new HttpsError('invalid-argument', 'Each quotation must have a vendorId.');
      if (!Number.isInteger(q.amountPaise) || q.amountPaise <= 0)
        throw new HttpsError('invalid-argument', 'Each quotation amountPaise must be a positive integer.');
      if (!q.scopeNotes?.trim())
        throw new HttpsError('invalid-argument', 'Each quotation must have scopeNotes.');
    }

    // ── Fetch and validate the expense request ───────────────────────────────
    const requestRef = db.doc(`societies/${societyId}/expenseRequests/${input.requestId}`);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists)
      throw new HttpsError('not-found', 'Expense request not found.');

    const data = requestSnap.data()!;

    if (data.societyId !== societyId)
      throw new HttpsError('permission-denied', 'Cross-society access denied.');
    if (data.type !== 'snag')
      throw new HttpsError('invalid-argument', 'submitExpenseRequest is for snag take-up only.');
    if (data.status !== 'scheduled')
      throw new HttpsError('failed-precondition', `Cannot take up a snag in status "${data.status}".`);

    // ── Tier resolution + quorum check (D9) ─────────────────────────────────
    const [tiers, activeMCCount] = await Promise.all([
      fetchApprovalTiers(societyId),
      getActiveMCCount(societyId),
    ]);

    let requiredApprovers: number;
    try {
      requiredApprovers = resolveTier(data.estCostPaise as number, tiers);
    } catch (e: unknown) {
      throw new HttpsError('failed-precondition', e instanceof Error ? e.message : 'Tier error.');
    }

    if (requiredApprovers > activeMCCount) {
      throw new HttpsError(
        'failed-precondition',
        `This request needs ${requiredApprovers} MC approver(s) but the society only has ${activeMCCount} active MC member(s).`,
      );
    }

    // ── Write atomically ─────────────────────────────────────────────────────
    const batch = db.batch();

    batch.update(requestRef, {
      status: 'requested',
      requiredApprovers,
      submittedAt: FieldValue.serverTimestamp(),
    });

    for (const q of input.quotations) {
      const quoteRef = requestRef.collection('quotations').doc();
      const quoteData: Omit<Quotation, 'id'> = {
        societyId,
        requestId: input.requestId,
        vendorId: q.vendorId.trim(),
        amountPaise: q.amountPaise,
        scopeNotes: q.scopeNotes.trim(),
        ...(q.documentRef?.trim() && { documentRef: q.documentRef.trim() }),
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
      };
      batch.set(quoteRef, quoteData);
    }

    await batch.commit();

    await writeAudit({
      societyId,
      actorUid: uid,
      actorRole: role,
      action: 'expense_request_submitted',
      targetType: 'expenseRequest',
      targetId: input.requestId,
      after: { status: 'requested', requiredApprovers },
    });

    void dispatchNotification({
      societyId,
      type: 'expense_request_submitted',
      toRole: 'mc',
      payload: { requestId: input.requestId, title: data.title as string, requestType: 'snag' },
    }).catch(e => console.error('notify error:', e));

    return { ok: true };
  },
);
