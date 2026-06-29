import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { assertSameSociety, requireCaller } from '../lib/context';
import { writeAudit } from '../lib/audit';
import { buildTransaction } from '../lib/transactions';
import { requireDateString, requirePaymentMode } from '../lib/validate';
import type { PaymentMode } from '../lib/types';

interface MarkInstancePaidInput {
  instanceId: string;
  occurredAt: string;   // "YYYY-MM-DD"
  mode: PaymentMode;
  referenceNo?: string;
}

export const markInstancePaid = onCall(async (request) => {
    const { uid, societyId, role } = requireCaller(request);
    if (role !== 'admin' && role !== 'fm')
      throw new HttpsError('permission-denied', 'Must be Admin or FM.');

    const { instanceId, occurredAt, mode, referenceNo } = request.data as MarkInstancePaidInput;

    if (!instanceId?.trim()) throw new HttpsError('invalid-argument', 'instanceId required.');
    requireDateString(occurredAt, 'occurredAt');
    requirePaymentMode(mode, 'mode');

    // Load instance
    const instanceRef = db.doc(`societies/${societyId}/recurringInstances/${instanceId}`);
    const instanceSnap = await instanceRef.get();
    if (!instanceSnap.exists) throw new HttpsError('not-found', 'Instance not found.');

    const instance = instanceSnap.data()!;
    assertSameSociety(instance.societyId as string, societyId);
    if (instance.status === 'paid')
      throw new HttpsError('failed-precondition', 'Instance is already paid.');

    // Write the transaction
    const txnRef = db.collection(`societies/${societyId}/transactions`).doc();
    const txnId = txnRef.id;
    const txnData = buildTransaction({
      txnId, societyId, direction: 'out',
      amountPaise: instance.amountPaise as number,
      accountId: instance.accountId as string,
      fundHead: instance.fundHead as string,
      mode,
      description: `${instance.name as string} — ${instance.period as string}`,
      occurredAt: Timestamp.fromDate(new Date(`${occurredAt}T00:00:00.000Z`)),
      sourceType: 'recurringPayment',
      sourceId: instanceId,
      createdBy: uid,
      referenceNo,
    });

    // Mark instance paid + write transaction atomically
    const batch = db.batch();
    batch.set(txnRef, txnData);
    batch.update(instanceRef, {
      status: 'paid',
      transactionId: txnId,
      paidAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    await writeAudit({
      societyId,
      actorUid:   uid,
      actorRole:  role,
      action:     'recurring_instance_paid',
      targetType: 'recurringInstance',
      targetId:   instanceId,
      after: {
        transactionId: txnId,
        amountPaise:   instance.amountPaise as number,
        accountId:     instance.accountId as string,
        fundHead:      instance.fundHead as string,
        period:        instance.period as string,
      },
    });

    return { txnId };
  },
);
