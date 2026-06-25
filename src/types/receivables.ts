import type { Timestamp } from 'firebase/firestore';
import type { FundCode } from './config';

// ─── Collections ─────────────────────────────────────────────────────────────

export type CollectionEntryStatus = 'pending' | 'paid' | 'overdue';

export interface CollectionPeriod {
  id: string;           // "YYYY-MM"
  societyId: string;
  period: string;       // "YYYY-MM"
  expectedPaise: number;
  receivedPaise: number;
  unitCount: number;
  paidCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CollectionEntry {
  id: string;           // unitId
  societyId: string;
  period: string;       // "YYYY-MM"
  unitId: string;
  flatNumber: string;   // snapshot for display
  tower?: string;       // snapshot for display
  ownerName: string;    // snapshot for display
  maintenancePaise: number;
  commonElectricityPaise: number;
  billedPaise: number;  // maintenancePaise + commonElectricityPaise
  status: CollectionEntryStatus;
  dueDate: string;      // "YYYY-MM-DD"
  paidAt?: string;      // "YYYY-MM-DD"
  txnId?: string;
  referenceNo?: string;
  accountId?: string;
  fundHead?: FundCode;
  notes?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

// ─── Vendor income ────────────────────────────────────────────────────────────

export type VendorIncomeStatus = 'pending' | 'paid' | 'partial';

export interface VendorIncomeRecord {
  id: string;
  societyId: string;
  vendorId: string;
  vendorRelationId: string;
  period: string;       // "YYYY-MM"
  expectedPaise: number;
  receivedPaise: number;
  status: VendorIncomeStatus;
  dueDate: string;      // "YYYY-MM-DD"
  txnId?: string;
  remarks?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
}
