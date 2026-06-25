import type { Timestamp } from 'firebase/firestore';
import type { FundCode } from './config';

export type ExpenseRequestType = 'maintenance' | 'snag';

// No 'rejected' — requests stay 'requested' until approved or withdrawn (D9d)
export type ExpenseRequestStatus =
  | 'scheduled'   // snag only: Admin created, awaiting FM take-up (D9c)
  | 'requested'   // in the approval queue (maintenance: on create; snag: after FM take-up)
  | 'approved'    // required MC approvals received; approvedAmountPaise set
  | 'disbursed'   // ≥1 disbursement posted, not yet completed
  | 'completed'   // FM closed after full disbursement
  | 'withdrawn';  // FM (maintenance) / Admin (snag) withdrew before any disbursement

export type BudgetWindowMode = 'month' | 'quarter' | 'year' | 'custom' | 'by_date';

export interface BudgetWindow {
  mode: BudgetWindowMode;
  startDate: string;   // "YYYY-MM-DD"
  endDate: string;     // "YYYY-MM-DD"
  label: string;       // e.g. "Q1 FY26"
}

export type ExpensePriority = 'low' | 'medium' | 'high';

export type ExpenseCategory =
  | 'electrical'
  | 'plumbing'
  | 'civil'
  | 'mechanical'
  | 'landscaping'
  | 'security'
  | 'housekeeping'
  | 'other';

export interface ExpenseRequest {
  id: string;
  societyId: string;
  type: ExpenseRequestType;
  title: string;
  description: string;
  location?: string;
  priority: ExpensePriority;
  category: ExpenseCategory;
  fundHead: FundCode;
  estCostPaise: number;
  approvedAmountPaise?: number;    // hard cap set when status → 'approved' (D9a)
  disbursedAmountPaise?: number;   // running sum of all disbursements posted (D9a)
  requiredApprovers?: number;      // snapshotted from tier at submit (D9)
  approvalCount?: number;         // denormalized count of MC approvals so far
  approvedBy?: string[];          // denormalized list of MC UIDs who approved (for UI self-check)
  status: ExpenseRequestStatus;
  plan?: BudgetWindow;            // snag only (D9c)
  parentRequestId?: string;       // top-up link (D9a)
  createdBy: string;              // uid
  createdRole: string;            // 'admin' | 'fm'
  submittedAt?: Timestamp;        // when entered queue — drives Requested-queue aging (D9d)
  createdAt: Timestamp;
  // Completion fields (set by closeExpenseRequest)
  evidenceRefs?: string[];
  closingNote?: string;
}

// ── Subcollection types ────────────────────────────────────────────────────

export interface Quotation {
  id: string;
  societyId: string;
  requestId: string;
  vendorId: string;
  amountPaise: number;
  scopeNotes: string;
  documentRef?: string;    // legacy: single Storage path
  documentRefs?: string[]; // multi-doc: array of Storage paths
  createdBy: string;
  createdAt: Timestamp;
}

// One entry = one MC vote. No reject action — item stays 'requested' otherwise (D9d)
export interface RequestApproval {
  id: string;
  societyId: string;
  requestId: string;
  mcUid: string;
  note?: string;
  approvedAt: Timestamp;
}

export interface RequestNote {
  id: string;
  societyId: string;
  requestId: string;
  authorUid: string;
  role: string;
  text: string;
  at: Timestamp;
}

export interface Disbursement {
  id: string;
  societyId: string;
  requestId: string;
  amountPaise: number;
  txnId: string;           // link to societies/{sid}/transactions/{txnId}
  invoiceRef?: string;     // legacy: single Storage path
  invoiceRefs?: string[];  // multi-doc: array of Storage paths
  kind: 'partial' | 'final';
  paidAt: Timestamp;
}

// Added to ExpenseRequest when FM marks the request completed
export interface CompletionEvidence {
  evidenceRefs?: string[];  // Storage paths for photos/docs
  closingNote?: string;
}
