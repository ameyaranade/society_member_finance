import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { writeAudit } from '../lib/audit';

interface WithdrawExpenseRequestInput {
  requestId: string;
}

export const withdrawExpenseRequest = onCall(
  { region: 'asia-south1' },
  async (request): Promise<{ ok: true }> => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Not signed in.');

    const token     = request.auth?.token as Record<string, unknown> | undefined;
    const societyId = token?.societyId as string | undefined;
    const role      = token?.role as string | undefined;

    if (!societyId) throw new HttpsError('failed-precondition', 'No active society.');
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

    if (data.societyId !== societyId)
      throw new HttpsError('permission-denied', 'Cross-society access denied.');
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

    return { ok: true };
  },
);
