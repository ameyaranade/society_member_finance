/**
 * Parses a worksheet (from SheetJS) into UnitCreateInput rows.
 * The actual column names come from columnMap.ts — edit that file
 * when the source format changes, not this parser.
 */
import type { WorkSheet } from 'xlsx';
import { utils } from 'xlsx';
import { UNITS_COLUMN_MAP } from './columnMap';
import { toPaise } from '../money';
import type { UnitCreateInput } from '../../features/receivables/useUnits';

export interface ParseResult<T> {
  rows: T[];
  errors: Array<{ row: number; message: string }>;
}

/** Build a case-insensitive header→column index map from a sheet. */
function buildHeaderIndex(sheet: WorkSheet): Map<string, number> {
  const range = utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  const map = new Map<string, number>();
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = sheet[utils.encode_cell({ r: range.s.r, c: col })];
    if (cell?.v != null) {
      map.set(String(cell.v).trim().toLowerCase(), col);
    }
  }
  return map;
}

function getCell(sheet: WorkSheet, row: number, col: number | undefined): string {
  if (col === undefined) return '';
  const cell = sheet[utils.encode_cell({ r: row, c: col })];
  return cell?.v != null ? String(cell.v).trim() : '';
}

function getNum(sheet: WorkSheet, row: number, col: number | undefined): number | undefined {
  if (col === undefined) return undefined;
  const cell = sheet[utils.encode_cell({ r: row, c: col })];
  if (cell?.v == null) return undefined;
  const n = parseFloat(String(cell.v));
  return isNaN(n) ? undefined : n;
}

export function parseUnitsSheet(sheet: WorkSheet): ParseResult<UnitCreateInput> {
  const rows: UnitCreateInput[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  const headers = buildHeaderIndex(sheet);
  const M = UNITS_COLUMN_MAP;

  const col = (key: keyof typeof M) => headers.get(M[key].toLowerCase());

  const range = utils.decode_range(sheet['!ref'] ?? 'A1:A1');

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const flatNumber = getCell(sheet, r, col('flatNumber'));
    if (!flatNumber) continue; // skip blank rows

    const ownerName = getCell(sheet, r, col('ownerName'));
    if (!ownerName) {
      errors.push({ row: r + 1, message: `Flat ${flatNumber}: Owner Name is required` });
      continue;
    }

    const maintRupees = getNum(sheet, r, col('maintenanceAmountRupees'));
    const elecRupees  = getNum(sheet, r, col('commonElectricityAmountRupees'));

    if (maintRupees == null) {
      errors.push({ row: r + 1, message: `Flat ${flatNumber}: Maintenance amount is required` });
      continue;
    }

    const billedPartyRaw = getCell(sheet, r, col('billedParty')).toLowerCase();
    const billedParty = billedPartyRaw === 'tenant' ? 'tenant' as const : 'owner' as const;

    const tenantName = getCell(sheet, r, col('tenantName'));
    const tenantContact = getCell(sheet, r, col('tenantContact'));

    rows.push({
      flatNumber,
      tower:          getCell(sheet, r, col('tower')) || undefined,
      areaSqft:       getNum(sheet, r, col('areaSqft')),
      owner:          { name: ownerName, contact: getCell(sheet, r, col('ownerContact')) || undefined },
      tenant:         tenantName ? { name: tenantName, contact: tenantContact || undefined } : undefined,
      billedParty,
      maintenanceAmountPaise:          toPaise(maintRupees),
      commonElectricityAmountPaise:    toPaise(elecRupees ?? 0),
    });
  }

  return { rows, errors };
}
