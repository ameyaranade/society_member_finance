import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { requireCaller } from '../lib/context';
import { writeAudit } from '../lib/audit';
import { buildTransaction } from '../lib/transactions';
import { requirePositivePaise, requireDateString, requirePaymentMode } from '../lib/validate';
import type { PaymentMode, TransactionSourceType, TransactionDirection } from '../lib/types';
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

export const recordPayment = onCall(async (request) => {
    const { uid, societyId, role } = requireCaller(request);
    if (role !== 'admin' && role !== 'fm')
      throw new HttpsError('permission-denied', 'Must be Admin or FM.');

    const input = request.data as RecordPaymentInput;

    if (input.direction !== 'in' && input.direction !== 'out')
      throw new HttpsError('invalid-argument', 'direction must be "in" or "out".');
    requirePositivePaise(input.amountPaise, 'amountPaise');
    requirePaymentMode(input.mode, 'mode');
    if (!VALID_SOURCE_TYPES.has(input.sourceType))
      throw new HttpsError('invalid-argument', 'Invalid sourceType.');
    if (!input.description?.trim())
      throw new HttpsError('invalid-argument', 'description is required.');
    requireDateString(input.occurredAt, 'occurredAt');

    // Manual entries (opening balances, interest, adjustments) require Admin
    if (input.sourceType === 'manual' && role !== 'admin')
      throw new HttpsError('permission-denied', 'Manual entries require Admin role.');

    // Verify account belongs to this society
    const accountSnap = await db.doc(`societies/${societyId}/accounts/${input.accountId}`).get();
    if (!accountSnap.exists) throw new HttpsError('not-found', 'Account not found.');

    const txnRef = db.collection(`societies/${societyId}/transactions`).doc();
    const txnId = txnRef.id;
    const txnData = buildTransaction({
      txnId, societyId,
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
      referenceNo: input.referenceNo,
    });

    await txnRef.set(txnData);

    await writeAudit({
      societyId,
      actorUid:   uid,
      actorRole:  role,
      action:     'transaction_recorded',
      targetType: 'transaction',
      targetId:   txnId,
      after: {
        direction:   input.direction,
        amountPaise: input.amountPaise,
        accountId:   input.accountId,
        fundHead:    input.fundHead,
        sourceType:  input.sourceType,
      },
    });

    return { txnId };
  },
);
