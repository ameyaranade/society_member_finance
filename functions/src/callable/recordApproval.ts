import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { assertSameSociety, requireCaller } from '../lib/context';
import { writeAudit } from '../lib/audit';
import { dispatchNotificationSafe } from '../lib/notify';

interface RecordApprovalInput {
  requestId: string;
  note?: string;
}

export const recordApproval = onCall(async (request): Promise<{ ok: true; approved: boolean }> => {
    const { uid, societyId, role } = requireCaller(request);
    if (role !== 'mc')
      throw new HttpsError('permission-denied', 'Only MC members can approve requests.');

    const { requestId, note } = request.data as RecordApprovalInput;
    if (!requestId?.trim())
      throw new HttpsError('invalid-argument', 'requestId is required.');

    const requestRef = db.doc(`societies/${societyId}/expenseRequests/${requestId}`);

    // Use a transaction to avoid race conditions on the approval count
    const { fullyApproved, requestTitle, approvalCount, requiredApprovers } =
      await db.runTransaction(async txn => {
        const reqSnap = await txn.get(requestRef);
        if (!reqSnap.exists)
          throw new HttpsError('not-found', 'Expense request not found.');

        const data = reqSnap.data()!;

        assertSameSociety(data.societyId as string, societyId);
        if (data.status !== 'requested')
          throw new HttpsError('failed-precondition', `Cannot approve a request with status "${data.status}".`);

        // No self-approval
        const approvedBy: string[] = data.approvedBy ?? [];
        if (approvedBy.includes(uid))
          throw new HttpsError('failed-precondition', 'You have already approved this request.');

        const newCount          = (data.approvalCount ?? 0) + 1;
        const reqApprovers      = data.requiredApprovers ?? 1;
        const approved          = newCount >= reqApprovers;

        // Write approval subdoc
        const approvalRef = requestRef.collection('approvals').doc();
        txn.set(approvalRef, {
          societyId,
          requestId,
          mcUid: uid,
          ...(note?.trim() ? { note: note.trim() } : {}),
          approvedAt: FieldValue.serverTimestamp(),
        });

        // Update request doc
        txn.update(requestRef, {
          approvalCount: newCount,
          approvedBy:    [...approvedBy, uid],
          ...(approved
            ? { status: 'approved', approvedAmountPaise: data.estCostPaise }
            : {}),
        });

        return {
          fullyApproved:    approved,
          requestTitle:     data.title as string,
          approvalCount:    newCount,
          requiredApprovers: reqApprovers,
        };
      });

    await writeAudit({
      societyId,
      actorUid:  uid,
      actorRole: role,
      action:    fullyApproved ? 'expense_request_approved' : 'expense_approval_recorded',
      targetType: 'expenseRequest',
      targetId:   requestId,
      after: fullyApproved ? { status: 'approved' } : { approvalRecorded: true },
    });

    dispatchNotificationSafe({
      societyId,
      type: fullyApproved ? 'expense_request_approved' : 'expense_approval_recorded',
      toRole: 'fm',
      payload: {
        requestId,
        title: requestTitle,
        approvalCount,
        requiredApprovers,
      },
    });

    return { ok: true, approved: fullyApproved };
  },
);
