import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { requireCaller } from '../lib/context';
import { requirePositivePaise } from '../lib/validate';
import { writeAudit } from '../lib/audit';
import type {
  BudgetWindow,
  ExpenseCategory,
  ExpensePriority,
  ExpenseRequest,
} from '../lib/types';

interface ScheduleSnagInput {
  title: string;
  description: string;
  location?: string;
  priority: ExpensePriority;
  category: ExpenseCategory;
  fundHead: string;
  estCostPaise: number;
  plan: BudgetWindow;
  parentRequestId?: string;
}

const VALID_PRIORITIES = new Set<ExpensePriority>(['low', 'medium', 'high']);
const VALID_CATEGORIES = new Set<ExpenseCategory>([
  'electrical', 'plumbing', 'civil', 'mechanical',
  'landscaping', 'security', 'housekeeping', 'other',
]);
const VALID_FUND_HEADS  = new Set(['general', 'sinking', 'corpus', 'repair']);
const VALID_PLAN_MODES  = new Set<BudgetWindow['mode']>([
  'month', 'quarter', 'year', 'custom', 'by_date',
]);

export const scheduleSnag = onCall(async (request): Promise<{ requestId: string }> => {
    const { uid, societyId, role } = requireCaller(request);
    if (role !== 'admin')
      throw new HttpsError('permission-denied', 'Only Admin can schedule a snag.');

    const input = request.data as ScheduleSnagInput;

    // ── Validate ──────────────────────────────────────────────────────────────
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

    // Validate budget window (D9c)
    const plan = input.plan;
    if (!plan || !VALID_PLAN_MODES.has(plan.mode))
      throw new HttpsError('invalid-argument', 'plan.mode must be one of: month, quarter, year, custom, by_date.');
    if (!plan.startDate?.trim() || !plan.endDate?.trim())
      throw new HttpsError('invalid-argument', 'plan.startDate and plan.endDate are required.');
    if (!plan.label?.trim())
      throw new HttpsError('invalid-argument', 'plan.label is required.');

    // ── Write ─────────────────────────────────────────────────────────────────
    const requestRef = db.collection(`societies/${societyId}/expenseRequests`).doc();
    const requestId  = requestRef.id;

    const reqData: Omit<ExpenseRequest, 'id'> = {
      societyId,
      type: 'snag',
      title: input.title.trim(),
      description: input.description.trim(),
      ...(input.location?.trim() && { location: input.location.trim() }),
      priority: input.priority,
      category: input.category,
      fundHead: input.fundHead,
      estCostPaise: input.estCostPaise,
      status: 'scheduled',
      plan: {
        mode: plan.mode,
        startDate: plan.startDate.trim(),
        endDate: plan.endDate.trim(),
        label: plan.label.trim(),
      },
      ...(input.parentRequestId?.trim() && { parentRequestId: input.parentRequestId.trim() }),
      createdBy: uid,
      createdRole: role,
      createdAt: FieldValue.serverTimestamp(),
    };

    await requestRef.set(reqData);

    await writeAudit({
      societyId,
      actorUid: uid,
      actorRole: role,
      action: 'snag_scheduled',
      targetType: 'expenseRequest',
      targetId: requestId,
      after: { type: 'snag', title: input.title.trim(), estCostPaise: input.estCostPaise, plan: reqData.plan },
    });

    return { requestId };
  },
);
