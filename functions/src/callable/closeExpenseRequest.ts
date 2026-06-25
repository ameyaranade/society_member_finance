import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { assertSameSociety, requireCaller } from '../lib/context';
import { writeAudit } from '../lib/audit';
import { dispatchNotificationSafe } from '../lib/notify';

interface CloseExpenseRequestInput {
  requestId: string;
  closingNote?: string;
}

export const closeExpenseRequest = onCall(async (request): Promise<{ ok: true }> => {
    const { uid, societyId, role } = requireCaller(request);
    if (role !== 'fm')
      throw new HttpsError('permission-denied', 'Only FM can close expense requests.');

    const { requestId, closingNote } = request.data as CloseExpenseRequestInput;
    if (!requestId?.trim())
      throw new HttpsError('invalid-argument', 'requestId is required.');

    const requestRef = db.doc(`societies/${societyId}/expenseRequests/${requestId}`);
    const reqSnap    = await requestRef.get();

    if (!reqSnap.exists)
      throw new HttpsError('not-found', 'Expense request not found.');

    const data = reqSnap.data()!;

    assertSameSociety(data.societyId as string, societyId);

    if (data.status !== 'disbursed')
      throw new HttpsError(
        'failed-precondition',
        `Cannot close: request is "${data.status as string}", must be "disbursed".`,
      );

    const update: Record<string, unknown> = {
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      completedBy: uid,
    };
    if (closingNote?.trim()) update.closingNote = closingNote.trim();

    await requestRef.update(update);

    await writeAudit({
      societyId,
      actorUid:   uid,
      actorRole:  role,
      action:     'expense_request_completed',
      targetType: 'expenseRequest',
      targetId:   requestId,
      after: { status: 'completed' },
    });

    dispatchNotificationSafe({
      societyId,
      type: 'expense_request_completed',
      toRole: 'admin',
      payload: { requestId, title: data.title as string },
    });

    return { ok: true };
  },
);
