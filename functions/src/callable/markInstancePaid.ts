import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import type { PaymentMode } from '../lib/types';

const VALID_MODES = new Set<PaymentMode>(['cash', 'upi', 'cheque', 'bank']);

interface MarkInstancePaidInput {
  instanceId: string;
  occurredAt: string;   // "YYYY-MM-DD"
  mode: PaymentMode;
  referenceNo?: string;
}

export const markInstancePaid = onCall(
  { region: 'asia-south1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Not signed in.');

    const token = request.auth?.token as Record<string, unknown> | undefined;
    const societyId = token?.societyId as string | undefined;
    const role = token?.role as string | undefined;

    if (!societyId) throw new HttpsError('failed-precondition', 'No active society.');
    if (role !== 'admin' && role !== 'fm')
      throw new HttpsError('permission-denied', 'Must be Admin or FM.');

    const { instanceId, occurredAt, mode, referenceNo } = request.data as MarkInstancePaidInput;

    if (!instanceId?.trim()) throw new HttpsError('invalid-argument', 'instanceId required.');
    if (!occurredAt?.match(/^\d{4}-\d{2}-\d{2}$/))
      throw new HttpsError('invalid-argument', 'occurredAt must be "YYYY-MM-DD".');
    if (!VALID_MODES.has(mode))
      throw new HttpsError('invalid-argument', 'mode must be cash, upi, cheque, or bank.');

    // Load instance
    const instanceRef = db.doc(`societies/${societyId}/recurringInstances/${instanceId}`);
    const instanceSnap = await instanceRef.get();
    if (!instanceSnap.exists) throw new HttpsError('not-found', 'Instance not found.');

    const instance = instanceSnap.data()!;
    if (instance.societyId !== societyId)
      throw new HttpsError('permission-denied', 'Cross-society access denied.');
    if (instance.status === 'paid')
      throw new HttpsError('failed-precondition', 'Instance is already paid.');

    // Write the transaction
    const txnRef = db.collection(`societies/${societyId}/transactions`).doc();
    const txnId = txnRef.id;

    const txnData: Record<string, unknown> = {
      id: txnId,
      societyId,
      direction: 'out',
      amountPaise: instance.amountPaise,
      accountId: instance.accountId,
      fundHead: instance.fundHead,
      mode,
      description: `${instance.name} — ${instance.period}`,
      occurredAt: Timestamp.fromDate(new Date(`${occurredAt}T00:00:00.000Z`)),
      sourceType: 'recurringPayment',
      sourceId: instanceId,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (referenceNo?.trim()) txnData.referenceNo = referenceNo.trim();

    // Mark instance paid + write transaction atomically
    const batch = db.batch();
    batch.set(txnRef, txnData);
    batch.update(instanceRef, {
      status: 'paid',
      transactionId: txnId,
      paidAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return { txnId };
  },
);
