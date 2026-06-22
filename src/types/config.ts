import type { Timestamp } from 'firebase/firestore';

export type AccountType = 'bank' | 'cash' | 'sinking' | 'petty';
export type FundCode = 'general' | 'sinking' | 'corpus' | 'repair';
export type VendorRelationKind = 'income' | 'expense';

export interface ApprovalTier {
  minPaise: number;
  maxPaise: number | null; // null = open-ended last tier
  requiredApprovers: number;
}

export interface SocietyConfig {
  currency: string;     // 'INR'
  fyStartMonth: number; // 1–12; default 4 (April)
  billing: { defaultBilledParty: 'owner' | 'tenant' };
  approvalTiers: ApprovalTier[];
}

export interface Account {
  id: string;
  societyId: string;
  name: string;
  type: AccountType;
  openingBalancePaise: number;
  currentBalancePaise: number; // maintained by recomputeBalances Function
  createdAt: Timestamp;
  createdBy: string;
}

export interface FundHead {
  id: string;
  societyId: string;
  name: string;
  code: FundCode;
  description?: string;
  createdAt: Timestamp;
  createdBy: string;
}

export interface Vendor {
  id: string;
  societyId: string;
  name: string;
  contact?: string;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
}

export interface VendorRelation {
  id: string;
  societyId: string;
  vendorId: string;
  kind: VendorRelationKind;
  description: string;
  agreementAmountPaise?: number;
  periodicity?: string;
  createdAt: Timestamp;
  createdBy: string;
}
