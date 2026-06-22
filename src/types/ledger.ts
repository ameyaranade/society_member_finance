import type { Timestamp } from 'firebase/firestore';
import type { FundCode } from './config';

export type PaymentMode = 'cash' | 'upi' | 'cheque' | 'bank';
export type TransactionSourceType =
  | 'collection'
  | 'vendorIncome'
  | 'recurringPayment'
  | 'expenseRequest'
  | 'manual';
export type TransactionDirection = 'in' | 'out';

export interface Transaction {
  id: string;
  societyId: string;
  direction: TransactionDirection;
  amountPaise: number;
  accountId: string;
  fundHead: string;
  mode: PaymentMode;
  referenceNo?: string;
  description: string;
  occurredAt: Timestamp;
  sourceType: TransactionSourceType;
  sourceId: string;
  createdBy: string;
  createdAt: Timestamp;
}

export type RecurringCategory =
  | 'maintenance'
  | 'utility'
  | 'staff'
  | 'security'
  | 'housekeeping'
  | 'other';

export interface RecurringPayment {
  id: string;
  societyId: string;
  name: string;
  category: RecurringCategory;
  vendorId?: string;
  amountPaise: number;
  dueDay: number;            // 1–28
  fundHead: FundCode;
  accountId: string;
  active: boolean;
  startYearMonth: string;    // "YYYY-MM"
  endYearMonth?: string;     // "YYYY-MM" — open-ended if absent
  description?: string;
  createdAt: Timestamp;
  createdBy: string;
}

export type RecurringInstanceStatus = 'pending' | 'paid' | 'skipped';

export interface RecurringInstance {
  id: string;                    // "{recurringPaymentId}_{period}"
  societyId: string;
  recurringPaymentId: string;
  period: string;                // "YYYY-MM"
  name: string;                  // snapshot from template
  category: RecurringCategory;
  vendorId?: string;
  amountPaise: number;
  dueDate: string;               // "YYYY-MM-DD"
  fundHead: FundCode;
  accountId: string;
  status: RecurringInstanceStatus;
  transactionId?: string;        // set when paid
  paidAt?: Timestamp;
  createdAt: Timestamp;
}

export interface PeriodBalance {
  societyId: string;
  period: string; // "YYYY-MM"
  byAccount: Record<string, { inPaise: number; outPaise: number }>;
  byFund: Record<string, { inPaise: number; outPaise: number }>;
  totalInPaise: number;
  totalOutPaise: number;
  updatedAt: Timestamp;
}
