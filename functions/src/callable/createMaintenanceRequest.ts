import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { requireCaller } from '../lib/context';
import { requirePositivePaise } from '../lib/validate';
import { writeAudit } from '../lib/audit';
import { dispatchNotificationSafe } from '../lib/notify';
import { resolveRequiredApprovers } from '../lib/tierHelpers';
import type {
  ExpenseCategory,
  ExpensePriority,
  Quotation,
  ExpenseRequest,
} from '../lib/types';

interface QuotationInput {
  vendorId: string;
  amountPaise: number;
  scopeNotes: string;
  documentRef?: string;  // Storage path, already uploaded by client
}

interface CreateMaintenanceRequestInput {
  title: string;
  description: string;
  location?: string;
  priority: ExpensePriority;
  category: ExpenseCategory;
  fundHead: string;
  estCostPaise: number;
  quotations: QuotationInput[];
}

const VALID_PRIORITIES = new Set<ExpensePriority>(['low', 'medium', 'high']);
const VALID_CATEGORIES = new Set<ExpenseCategory>([
  'electrical', 'plumbing', 'civil', 'mechanical',
  'landscaping', 'security', 'housekeeping', 'other',
]);
const VALID_FUND_HEADS = new Set(['general', 'sinking', 'corpus', 'repair']);

export const createMaintenanceRequest = onCall(async (request): Promise<{ requestId: string }> => {
    const { uid, societyId, role } = requireCaller(request);
    if (role !== 'fm' && role !== 'admin')
      throw new HttpsError('permission-denied', 'Only FM or Admin can create maintenance requests.');

    const input = request.data as CreateMaintenanceRequestInput;

    // ── Validate ─────────────────────────────────────────────────────────────
    if (!input.title?.trim())
      throw new HttpsError('invalid-argument', 'title is required.');
    if (!input.description?.trim())
      throw new HttpsError('invalid-argument', 'description is required.');
    if (!VALID_PRIORITIES.has(input.priority))
      throw new HttpsError('invalid-argument', 'Invalid priority.');
    if (!VALID_CATEGORIES.has(input.category))
      throw new HttpsError('invalid-argument', 'Invalid category.');
    if (!VALID_FUND_HEADS.has(input.fundHead))
      throw new HttpsError('invalid-argument', 'Invalid fundHead.');
    requirePositivePaise(input.estCostPaise, 'estCostPaise');
    if (!Array.isArray(input.quotations) || input.quotations.length === 0)
      throw new HttpsError('invalid-argument', 'At least one quotation is required.');
    for (const q of input.quotations) {
      if (!q.vendorId?.trim())
        throw new HttpsError('invalid-argument', 'Each quotation must have a vendorId.');
      requirePositivePaise(q.amountPaise, 'amountPaise');
      if (!q.scopeNotes?.trim())
        throw new HttpsError('invalid-argument', 'Each quotation must have scopeNotes.');
    }

    // ── Tier resolution + quorum check (D9) ─────────────────────────────────
    const requiredApprovers = await resolveRequiredApprovers(societyId, input.estCostPaise);

    // ── Write atomically ─────────────────────────────────────────────────────
    const requestRef = db.collection(`societies/${societyId}/expenseRequests`).doc();
    const requestId  = requestRef.id;

    const batch = db.batch();

    const reqData: Omit<ExpenseRequest, 'id'> = {
      societyId,
      type: 'maintenance',
      title: input.title.trim(),
      description: input.description.trim(),
      ...(input.location?.trim() && { location: input.location.trim() }),
      priority: input.priority,
      category: input.category,
      fundHead: input.fundHead,
      estCostPaise: input.estCostPaise,
      requiredApprovers,
      status: 'requested',
      createdBy: uid,
      createdRole: role,
      submittedAt: FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
      createdAt: FieldValue.serverTimestamp(),
    };
    batch.set(requestRef, reqData);

    for (const q of input.quotations) {
      const quoteRef = requestRef.collection('quotations').doc();
      const quoteData: Omit<Quotation, 'id'> = {
        societyId,
        requestId,
        vendorId: q.vendorId.trim(),
        amountPaise: q.amountPaise,
        scopeNotes: q.scopeNotes.trim(),
        ...(q.documentRef?.trim() && { documentRef: q.documentRef.trim() }),
        createdBy: uid,
        createdAt: FieldValue.serverTimestamp(),
      };
      batch.set(quoteRef, quoteData);
    }

    await batch.commit();

    await writeAudit({
      societyId,
      actorUid: uid,
      actorRole: role,
      action: 'expense_request_created',
      targetType: 'expenseRequest',
      targetId: requestId,
      after: { type: 'maintenance', title: input.title.trim(), estCostPaise: input.estCostPaise },
    });

    dispatchNotificationSafe({
      societyId,
      type: 'expense_request_created',
      toRole: 'mc',
      payload: { requestId, title: input.title.trim(), requestType: 'maintenance' },
    });

    return { requestId };
  },
);
