import type { WorkSheet } from 'xlsx';
import { utils } from 'xlsx';

export interface MemberImportRow {
  email: string;
  role: 'admin' | 'mc' | 'fm' | 'resident';
}

const VALID_ROLES = new Set(['admin', 'mc', 'fm', 'resident']);

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

/** Accepted column headers (case-insensitive). */
const EMAIL_HEADERS = ['email', 'email address', 'e-mail'];
const ROLE_HEADERS  = ['role', 'member role', 'type'];

export function parseMembersSheet(sheet: WorkSheet): { rows: MemberImportRow[]; errors: { row: number; message: string }[] } {
  const headers = buildHeaderIndex(sheet);
  const range   = utils.decode_range(sheet['!ref'] ?? 'A1:A1');

  const emailCol = EMAIL_HEADERS.map(h => headers.get(h)).find(c => c !== undefined);
  const roleCol  = ROLE_HEADERS.map(h => headers.get(h)).find(c => c !== undefined);

  const rows:   MemberImportRow[]                  = [];
  const errors: { row: number; message: string }[] = [];

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const email = getCell(sheet, r, emailCol).toLowerCase();
    const role  = getCell(sheet, r, roleCol).toLowerCase();

    if (!email) continue; // blank row

    if (!email.includes('@')) {
      errors.push({ row: r + 1, message: `Invalid email: "${email}"` });
      continue;
    }

    const resolvedRole = role === '' ? 'resident' : role;
    if (!VALID_ROLES.has(resolvedRole)) {
      errors.push({ row: r + 1, message: `Invalid role "${role}" for ${email}. Must be admin, mc, fm, or resident.` });
      continue;
    }

    rows.push({ email, role: resolvedRole as MemberImportRow['role'] });
  }

  return { rows, errors };
}
