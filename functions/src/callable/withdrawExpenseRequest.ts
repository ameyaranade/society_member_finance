import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { assertSameSociety, requireCaller } from '../lib/context';
import { writeAudit } from '../lib/audit';
import { dispatchNotificationSafe } from '../lib/notify';

interface WithdrawExpenseRequestInput {
  requestId: string;
}

export const withdrawExpenseRequest = onCall(async (request): Promise<{ ok: true }> => {
    const { uid, societyId, role } = requireCaller(request);
    if (role !== 'fm' && role !== 'admin')
      throw new HttpsError('permission-denied', 'Only FM or Admin can withdraw a request.');

    const { requestId } = request.data as WithdrawExpenseRequestInput;
    if (!requestId?.trim())
      throw new HttpsError('invalid-argument', 'requestId is required.');

    const requestRef  = db.doc(`societies/${societyId}/expenseRequests/${requestId}`);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists)
      throw new HttpsError('not-found', 'Expense request not found.');

    const data = requestSnap.data()!;

    assertSameSociety(data.societyId as string, societyId);
    if (data.status === 'withdrawn')
      throw new HttpsError('failed-precondition', 'Request is already withdrawn.');
    if (data.status === 'completed')
      throw new HttpsError('failed-precondition', 'Cannot withdraw a completed request.');
    if (data.status === 'disbursed')
      throw new HttpsError('failed-precondition', 'Cannot withdraw after disbursement has started.');

    // D9b separation of duties
    if (data.type === 'snag'        && role !== 'admin')
      throw new HttpsError('permission-denied', 'Only Admin can withdraw a snag request.');
    if (data.type === 'maintenance' && role !== 'fm')
      throw new HttpsError('permission-denied', 'Only FM can withdraw a maintenance request.');

    await requestRef.update({
      status: 'withdrawn',
      withdrawnAt: FieldValue.serverTimestamp(),
      withdrawnBy: uid,
    });

    await writeAudit({
      societyId,
      actorUid: uid,
      actorRole: role,
      action: 'expense_request_withdrawn',
      targetType: 'expenseRequest',
      targetId: requestId,
      before: { status: data.status },
      after:  { status: 'withdrawn' },
    });

    dispatchNotificationSafe({
      societyId,
      type: 'expense_request_withdrawn',
      toRole: 'mc',
      payload: { requestId, title: data.title as string, requestType: data.type as string },
    });

    return { ok: true };
  },
);
