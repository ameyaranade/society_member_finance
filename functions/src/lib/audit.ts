import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin';

export type AuditAction =
  | 'society_created'
  | 'user_invited'
  | 'user_activated'
  | 'role_changed'
  | 'user_deactivated'
  | 'user_reactivated'
  // Expense requests
  | 'expense_request_created'
  | 'expense_request_submitted'
  | 'expense_request_approved'
  | 'expense_request_withdrawn'
  | 'expense_request_disbursed'
  | 'expense_request_completed'
  | 'snag_scheduled';

interface WriteAuditParams {
  societyId: string;
  actorUid: string;
  actorRole?: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** Append an immutable audit entry. Clients cannot write auditLogs (rules: write: if false). */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  await db.collection(`societies/${params.societyId}/auditLogs`).add({
    ...params,
    at: FieldValue.serverTimestamp(),
    societyId: params.societyId,
  });
}
