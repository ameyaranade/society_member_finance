import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin';

export type NotificationType =
  | 'expense_request_created'
  | 'expense_request_submitted'
  | 'expense_request_approved'
  | 'expense_approval_recorded'
  | 'expense_request_withdrawn'
  | 'expense_request_disbursed'
  | 'expense_request_completed';

export interface NotificationPayload {
  requestId?: string;
  title?: string;
  requestType?: string;
  approvalCount?: number;
  requiredApprovers?: number;
  amountPaise?: number;
  [key: string]: unknown;
}

interface DispatchParams {
  societyId: string;
  type: NotificationType;
  payload: NotificationPayload;
  /** Notify specific UIDs directly. */
  toUids?: string[];
  /** Fan-out to all active members of this role. Takes precedence over toUids when set. */
  toRole?: string;
}

/**
 * Write in-app notification docs to /societies/{societyId}/notifications/{id}.
 * Non-critical: callers should .catch() so notification failure never blocks the main operation.
 */
export async function dispatchNotification(params: DispatchParams): Promise<void> {
  const { societyId, type, payload, toRole } = params;

  let recipientUids: string[] = params.toUids ?? [];

  if (toRole) {
    const snap = await db
      .collection('memberships')
      .where('societyId', '==', societyId)
      .where('role', '==', toRole)
      .where('status', '==', 'active')
      .get();

    recipientUids = snap.docs
      .map(d => d.data().uid as string | undefined)
      .filter((uid): uid is string => !!uid);
  }

  if (recipientUids.length === 0) return;

  // Firestore batch limit is 500; for a society this will never be exceeded
  const batch = db.batch();

  for (const toUid of recipientUids) {
    const ref = db.collection(`societies/${societyId}/notifications`).doc();
    batch.set(ref, {
      societyId,
      toUid,
      type,
      payload,
      channels: ['in_app'],
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  // Email stub — transactional email to be implemented in a later phase
}

/**
 * Fire-and-forget wrapper — notification failure must never block the main operation.
 * Call sites use this instead of inlining void dispatchNotification(...).catch(...).
 */
export function dispatchNotificationSafe(params: Parameters<typeof dispatchNotification>[0]): void {
  void dispatchNotification(params).catch(e => console.error('notify error:', e));
}
