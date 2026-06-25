import type { Timestamp } from 'firebase/firestore';

export type AccountType = 'bank' | 'cash' | 'sinking' | 'petty';
export type FundCode = 'general' | 'sinking' | 'corpus' | 'repair';
export type VendorRelationKind = 'income' | 'expense';
export type BilledParty = 'owner' | 'tenant';
export type ChargeModelType = 'per_sqft' | 'flat' | 'tier';

export interface ChargeModelTier {
  name: string;
  amountPaise: number;
}

export interface ChargeModel {
  type: ChargeModelType;
  ratePerSqftPaise?: number;  // used when type = 'per_sqft'
  flatAmountPaise?: number;   // used when type = 'flat'
  tiers?: ChargeModelTier[];  // used when type = 'tier'
}

export interface ApprovalTier {
  minPaise: number;
  maxPaise: number | null; // null = open-ended last tier
  requiredApprovers: number;
}

export interface SocietyConfig {
  currency: string;     // 'INR'
  fyStartMonth: number; // 1–12; default 4 (April)
  billing: { defaultBilledParty: BilledParty };
  approvalTiers: ApprovalTier[];
  chargeModel?: ChargeModel;
}

export interface UnitContact {
  name: string;
  contact?: string;
}

export interface Unit {
  id: string;
  societyId: string;
  flatNumber: string;
  tower?: string;
  areaSqft?: number;
  owner: UnitContact;
  tenant?: UnitContact;
  billedParty: BilledParty;
  maintenanceAmountPaise: number;
  commonElectricityAmountPaise: number;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
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
