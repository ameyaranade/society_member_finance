/**
 * Parses a worksheet into CollectionImportRow records.
 * Column names come from columnMap.ts — edit that file when the
 * source format changes.
 */
import type { WorkSheet } from 'xlsx';
import { utils } from 'xlsx';
import { COLLECTIONS_COLUMN_MAP } from './columnMap';
import { toPaise } from '../money';

export interface CollectionImportRow {
  flatNumber: string;
  tower?: string;
  status: 'paid' | 'pending' | 'overdue';
  amountReceivedPaise: number;  // 0 if not paid
  paymentDate?: string;         // "YYYY-MM-DD"
  referenceNo?: string;
  notes?: string;
}

export interface ParseResult<T> {
  rows: T[];
  errors: Array<{ row: number; message: string }>;
}

function buildHeaderIndex(sheet: WorkSheet): Map<string, number> {
  const range = utils.decode_range(sheet['!ref'] ?? 'A1:A1');
  const map = new Map<string, number>();
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = sheet[utils.encode_cell({ r: range.s.r, c: col })];
    if (cell?.v != null) map.set(String(cell.v).trim().toLowerCase(), col);
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

/** Parse a date that may be DD/MM/YYYY, YYYY-MM-DD, or a JS Date serial. */
function parseDate(raw: string): string | undefined {
  if (!raw) return undefined;
  // DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Excel serial number (SheetJS may return as number)
  const n = Number(raw);
  if (!isNaN(n) && n > 1000) {
    // Excel date serial: days since 1899-12-30
    const ms = (n - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return undefined;
}

function normaliseStatus(raw: string): CollectionImportRow['status'] {
  const s = raw.toLowerCase().trim();
  if (s === 'paid') return 'paid';
  if (s === 'overdue') return 'overdue';
  return 'pending';
}

export function parseCollectionsSheet(sheet: WorkSheet): ParseResult<CollectionImportRow> {
  const rows: CollectionImportRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  const headers = buildHeaderIndex(sheet);
  const M = COLLECTIONS_COLUMN_MAP;
  const col = (key: keyof typeof M) => headers.get(M[key].toLowerCase());

  const range = utils.decode_range(sheet['!ref'] ?? 'A1:A1');

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const flatNumber = getCell(sheet, r, col('flatNumber'));
    if (!flatNumber) continue;

    const statusRaw = getCell(sheet, r, col('status'));
    const status = normaliseStatus(statusRaw);

    const amtRupees = getNum(sheet, r, col('amountRupees')) ?? 0;
    const paymentDateRaw = getCell(sheet, r, col('paymentDate'));

    if (status === 'paid' && amtRupees <= 0) {
      errors.push({ row: r + 1, message: `Flat ${flatNumber}: Status is Paid but amount is 0` });
    }

    rows.push({
      flatNumber,
      tower:               getCell(sheet, r, col('tower')) || undefined,
      status,
      amountReceivedPaise: toPaise(amtRupees),
      paymentDate:         parseDate(paymentDateRaw),
      referenceNo:         getCell(sheet, r, col('referenceNo')) || undefined,
      notes:               getCell(sheet, r, col('notes')) || undefined,
    });
  }

  return { rows, errors };
}
