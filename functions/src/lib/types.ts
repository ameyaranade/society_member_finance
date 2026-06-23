/** Mirrored types for Cloud Functions — no shared package yet. */

export interface ApprovalTier {
  minPaise: number;
  maxPaise: number | null; // null = open-ended last tier
  requiredApprovers: number;
}

export type Role = 'admin' | 'mc' | 'fm' | 'resident';
export type MembershipStatus = 'invited' | 'active' | 'deactivated';

export type PaymentMode = 'cash' | 'upi' | 'cheque' | 'bank';
export type TransactionSourceType =
  | 'collection'
  | 'vendorIncome'
  | 'recurringPayment'
  | 'expenseRequest'
  | 'manual';
export type TransactionDirection = 'in' | 'out';

export interface AuthClaims {
  societyId?: string;
  role?: Role;
  superAdmin?: boolean;
  societies?: string[];
}

type WriteTimestamp = FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;

export interface Transaction {
  id?: string;
  societyId: string;
  direction: TransactionDirection;
  amountPaise: number;
  accountId: string;
  fundHead: string;
  mode: PaymentMode;
  referenceNo?: string;
  description: string;
  occurredAt: FirebaseFirestore.Timestamp;
  sourceType: TransactionSourceType;
  sourceId: string;
  createdBy: string;
  createdAt: WriteTimestamp;
}

export interface Membership {
  id: string;
  societyId: string;
  email: string;
  role: Role;
  status: MembershipStatus;
  invitedBy: string;
  invitedAt: WriteTimestamp;
  uid?: string;
  activatedAt?: WriteTimestamp;
  displayName?: string;
  photoURL?: string;
}

// ── Expense requests (D9 / D9a–D9e) ──────────────────────────────────────

export type ExpenseRequestType   = 'maintenance' | 'snag';
export type ExpenseRequestStatus = 'scheduled' | 'requested' | 'approved' | 'disbursed' | 'completed' | 'withdrawn';
export type ExpensePriority      = 'low' | 'medium' | 'high';
export type ExpenseCategory      = 'electrical' | 'plumbing' | 'civil' | 'mechanical' | 'landscaping' | 'security' | 'housekeeping' | 'other';

export interface BudgetWindow {
  mode: 'month' | 'quarter' | 'year' | 'custom' | 'by_date';
  startDate: string;
  endDate: string;
  label: string;
}

export interface ExpenseRequest {
  id?: string;
  societyId: string;
  type: ExpenseRequestType;
  title: string;
  description: string;
  location?: string;
  priority: ExpensePriority;
  category: ExpenseCategory;
  fundHead: string;
  estCostPaise: number;
  approvedAmountPaise?: number;
  disbursedAmountPaise?: number;   // running sum of all disbursements posted (D9a)
  requiredApprovers?: number;
  status: ExpenseRequestStatus;
  plan?: BudgetWindow;
  parentRequestId?: string;
  createdBy: string;
  createdRole: string;
  submittedAt?: FirebaseFirestore.Timestamp;
  createdAt: WriteTimestamp;
}

export interface Quotation {
  id?: string;
  societyId: string;
  requestId: string;
  vendorId: string;
  amountPaise: number;
  scopeNotes: string;
  documentRef?: string;
  createdBy: string;
  createdAt: WriteTimestamp;
}

export interface RequestApproval {
  id?: string;
  societyId: string;
  requestId: string;
  mcUid: string;
  note?: string;
  approvedAt: WriteTimestamp;
}

export interface RequestNote {
  id?: string;
  societyId: string;
  requestId: string;
  authorUid: string;
  role: string;
  text: string;
  at: WriteTimestamp;
}

export interface Disbursement {
  id?: string;
  societyId: string;
  requestId: string;
  amountPaise: number;
  txnId: string;
  invoiceRef?: string;
  evidenceRef?: string;
  kind: 'partial' | 'final';
  paidAt: WriteTimestamp;
}
