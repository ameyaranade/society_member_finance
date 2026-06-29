import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { Role, AuthClaims } from '../types/auth';
import type { ExpenseCategory, ExpensePriority } from '../types/requests';
import type { CollectionImportRow } from './import/collectionsParser';

type PaymentMode = 'cash' | 'upi' | 'cheque' | 'bank';
type DisbKind    = 'partial' | 'final';
type QuotationInput = { vendorId: string; amountPaise: number; scopeNotes: string; documentRefs?: string[] };

export const callables = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  refreshClaims: httpsCallable<void, AuthClaims>(
    functions, 'refreshClaims',
  ),

  // ── Society admin ────────────────────────────────────────────────────────────
  createSociety: httpsCallable<
    { societyId: string; name: string; address?: string; registrationNo?: string; totalUnits: number; adminEmail: string },
    { societyId: string }
  >(functions, 'createSociety'),

  inviteUser: httpsCallable<
    { email: string; role: Role; societyId: string },
    { membershipId: string }
  >(functions, 'inviteUser'),

  inviteUsersBulk: httpsCallable<
    { societyId: string; rows: { email: string; role: Role }[] },
    { invited: number; errors: { email: string; message: string }[] }
  >(functions, 'inviteUsersBulk'),

  updateMembership: httpsCallable<
    { membershipId: string; role?: Role; status?: 'active' | 'deactivated' },
    { ok: boolean }
  >(functions, 'updateMembership'),

  removeMembership: httpsCallable<
    { membershipId: string },
    { ok: true }
  >(functions, 'removeMembership'),

  // ── Expense requests ─────────────────────────────────────────────────────────
  recordApproval: httpsCallable<
    { requestId: string; note?: string },
    { ok: true; approved: boolean }
  >(functions, 'recordApproval'),

  withdrawExpenseRequest: httpsCallable<
    { requestId: string },
    { ok: true }
  >(functions, 'withdrawExpenseRequest'),

  closeExpenseRequest: httpsCallable<
    { requestId: string; closingNote?: string; evidenceRefs?: string[] },
    { ok: true }
  >(functions, 'closeExpenseRequest'),

  recordDisbursement: httpsCallable<
    { requestId: string; amountPaise: number; accountId: string; kind: DisbKind; paymentMode: PaymentMode; referenceNo?: string; paidAt: string; notes?: string; invoiceRefs?: string[] },
    { ok: true; txnId: string; disbId: string }
  >(functions, 'recordDisbursement'),

  // ── Maintenance requests ─────────────────────────────────────────────────────
  createMaintenanceRequest: httpsCallable<
    { title: string; description: string; location?: string; priority: ExpensePriority; category: ExpenseCategory; fundHead: string; estCostPaise: number; quotations: QuotationInput[] },
    { requestId: string }
  >(functions, 'createMaintenanceRequest'),

  // ── Snag requests ────────────────────────────────────────────────────────────
  scheduleSnag: httpsCallable<unknown, { requestId: string }>(
    functions, 'scheduleSnag',
  ),

  submitExpenseRequest: httpsCallable<
    { requestId: string; quotations: QuotationInput[] },
    { ok: true }
  >(functions, 'submitExpenseRequest'),

  // ── Receivables ──────────────────────────────────────────────────────────────
  applyChargeModel: httpsCallable<
    void,
    { updated: number; skipped: number }
  >(functions, 'applyChargeModel'),

  seedDashboardData: httpsCallable<
    { societyId: string },
    { created: number; months: number }
  >(functions, 'seedDashboardData'),

  importCollections: httpsCallable<
    { period: string; dueDate: string; accountId: string; fundHead: string; rows: CollectionImportRow[] },
    { period: string; imported: number; errors: Array<{ row: number; message: string }> }
  >(functions, 'importCollections'),
};
