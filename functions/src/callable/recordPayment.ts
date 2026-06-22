import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import type { PaymentMode, TransactionSourceType, TransactionDirection } from '../lib/types';

const VALID_MODES = new Set<PaymentMode>(['cash', 'upi', 'cheque', 'bank']);
const VALID_SOURCE_TYPES = new Set<TransactionSourceType>([
  'collection', 'vendorIncome', 'recurringPayment', 'expenseRequest', 'manual',
]);

interface RecordPaymentInput {
  direction: TransactionDirection;
  amountPaise: number;
  accountId: string;
  fundHead: string;
  mode: PaymentMode;
  referenceNo?: string;
  description: string;
  occurredAt: string; // "YYYY-MM-DD"
  sourceType: TransactionSourceType;
  sourceId?: string;
}

export const recordPayment = onCall(
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

    const input = request.data as RecordPaymentInput;

    if (input.direction !== 'in' && input.direction !== 'out')
      throw new HttpsError('invalid-argument', 'direction must be "in" or "out".');
    if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0)
      throw new HttpsError('invalid-argument', 'amountPaise must be a positive integer.');
    if (!VALID_MODES.has(input.mode))
      throw new HttpsError('invalid-argument', 'mode must be cash, upi, cheque, or bank.');
    if (!VALID_SOURCE_TYPES.has(input.sourceType))
      throw new HttpsError('invalid-argument', 'Invalid sourceType.');
    if (!input.description?.trim())
      throw new HttpsError('invalid-argument', 'description is required.');
    if (!input.occurredAt?.match(/^\d{4}-\d{2}-\d{2}$/))
      throw new HttpsError('invalid-argument', 'occurredAt must be "YYYY-MM-DD".');

    // Manual entries (opening balances, interest, adjustments) require Admin
    if (input.sourceType === 'manual' && role !== 'admin')
      throw new HttpsError('permission-denied', 'Manual entries require Admin role.');

    // Verify account belongs to this society
    const accountSnap = await db.doc(`societies/${societyId}/accounts/${input.accountId}`).get();
    if (!accountSnap.exists) throw new HttpsError('not-found', 'Account not found.');

    const txnRef = db.collection(`societies/${societyId}/transactions`).doc();
    const txnId = txnRef.id;

    const txnData: Record<string, unknown> = {
      id: txnId,
      societyId,
      direction: input.direction,
      amountPaise: input.amountPaise,
      accountId: input.accountId,
      fundHead: input.fundHead,
      mode: input.mode,
      description: input.description.trim(),
      occurredAt: Timestamp.fromDate(new Date(`${input.occurredAt}T00:00:00.000Z`)),
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? txnId,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (input.referenceNo?.trim()) txnData.referenceNo = input.referenceNo.trim();

    await txnRef.set(txnData);
    return { txnId };
  },
);
