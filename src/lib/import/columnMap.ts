/**
 * Column-mapping configuration for Excel imports.
 *
 * This file is the SINGLE place to change when the source Excel format
 * changes (e.g. NBH portal renames columns or adds/removes fields).
 * The parser files (unitsParser.ts, collectionsParser.ts) read these
 * mappings and do not hard-code column names.
 *
 * Values are the EXACT column header strings as they appear in the Excel.
 * Matches are case-insensitive and leading/trailing whitespace is trimmed.
 */

// ─── Units import ─────────────────────────────────────────────────────────────
export const UNITS_COLUMN_MAP = {
  flatNumber:                   'Flat No',
  tower:                        'Tower',
  areaSqft:                     'Area (Sqft)',
  ownerName:                    'Owner Name',
  ownerContact:                 'Owner Contact',
  tenantName:                   'Tenant Name',
  tenantContact:                'Tenant Contact',
  billedParty:                  'Billed Party',    // "owner" or "tenant"
  maintenanceAmountRupees:      'Maintenance (₹)',
  commonElectricityAmountRupees:'Common Electricity (₹)',
} as const;

// ─── Collections import ───────────────────────────────────────────────────────
export const COLLECTIONS_COLUMN_MAP = {
  flatNumber:       'Flat No',
  tower:            'Tower',
  status:           'Status',          // "Paid" | "Pending" | "Overdue" (case-insensitive)
  amountRupees:     'Amount Received (₹)',
  paymentDate:      'Payment Date',    // DD/MM/YYYY or YYYY-MM-DD
  referenceNo:      'Reference No',
  notes:            'Notes',
} as const;

export type UnitsColumnKey   = keyof typeof UNITS_COLUMN_MAP;
export type CollsColumnKey   = keyof typeof COLLECTIONS_COLUMN_MAP;
