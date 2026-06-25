/**
 * Generates sample Excel import files for:
 *   - test-fixtures/units-sample.xlsx   (units registry import)
 *   - test-fixtures/collections-sample.xlsx  (monthly collections import)
 *
 * Run with: node scripts/generate-samples.mjs
 *
 * Column names match columnMap.ts — update both files together if format changes.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Dynamic import of xlsx (ESM-compatible)
const XLSX = await import('xlsx');
const { utils, write } = XLSX.default ?? XLSX;

await mkdir(join(ROOT, 'test-fixtures'), { recursive: true });

// ─── Units sample ─────────────────────────────────────────────────────────────

const TOWERS = ['A', 'B', 'C', 'D'];
const FLOORS = 14;
const FLATS_PER_FLOOR = 4; // A101–A104, A201–A204, …

const OWNER_NAMES = [
  'Ramesh Kumar', 'Priya Sharma', 'Sanjay Mehta', 'Anita Iyer',
  'Vikram Nair', 'Sunita Patel', 'Arjun Reddy', 'Meena Krishnan',
  'Deepak Joshi', 'Kavitha Rao', 'Suresh Bhat', 'Lalitha Pillai',
];

function randName(seed) {
  return OWNER_NAMES[seed % OWNER_NAMES.length];
}

const unitsRows = [['Flat No', 'Tower', 'Area (Sqft)', 'Owner Name', 'Owner Contact',
                    'Tenant Name', 'Tenant Contact', 'Billed Party',
                    'Maintenance (₹)', 'Common Electricity (₹)']];

let idx = 0;
for (const tower of TOWERS) {
  for (let floor = 1; floor <= FLOORS; floor++) {
    for (let flat = 1; flat <= FLATS_PER_FLOOR; flat++) {
      idx++;
      const flatNo = `${tower}${floor}0${flat}`;
      const area = [850, 950, 1100, 1250][flat - 1];
      const ownerName = randName(idx);
      const ownerContact = `+91 98${String(idx).padStart(8, '0')}`;
      const hasTenant = idx % 5 === 0;
      const tenantName = hasTenant ? randName(idx + 7) : '';
      const tenantContact = hasTenant ? `+91 97${String(idx + 3).padStart(8, '0')}` : '';
      const billedParty = hasTenant ? 'tenant' : 'owner';
      const maintenance = area <= 950 ? 3500 : area <= 1100 ? 4000 : 4500;
      const electricity = 500;

      unitsRows.push([
        flatNo, tower, area, ownerName, ownerContact,
        tenantName, tenantContact, billedParty,
        maintenance, electricity,
      ]);
    }
  }
}

const unitsWb = utils.book_new();
const unitsWs = utils.aoa_to_sheet(unitsRows);
// Set column widths
unitsWs['!cols'] = [
  { wch: 8 }, { wch: 7 }, { wch: 10 }, { wch: 20 }, { wch: 16 },
  { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 22 },
];
utils.book_append_sheet(unitsWb, unitsWs, 'Units');
const unitsBuf = write(unitsWb, { type: 'buffer', bookType: 'xlsx' });
await writeFile(join(ROOT, 'test-fixtures', 'units-sample.xlsx'), unitsBuf);
console.log(`✓ units-sample.xlsx — ${unitsRows.length - 1} units (${TOWERS.length} towers × ${FLOORS} floors × ${FLATS_PER_FLOOR} flats)`);

// ─── Collections sample ───────────────────────────────────────────────────────

const PERIOD = '2026-06';
const DUE_DATE = '05/06/2026'; // DD/MM/YYYY as per Indian convention

const collectionsRows = [
  ['Flat No', 'Tower', 'Status', 'Amount Received (₹)', 'Payment Date', 'Reference No', 'Notes'],
];

idx = 0;
for (const tower of TOWERS) {
  for (let floor = 1; floor <= FLOORS; floor++) {
    for (let flat = 1; flat <= FLATS_PER_FLOOR; flat++) {
      idx++;
      const flatNo = `${tower}${floor}0${flat}`;
      const area = [850, 950, 1100, 1250][flat - 1];
      const maintenance = area <= 950 ? 3500 : area <= 1100 ? 4000 : 4500;
      const electricity = 500;
      const total = maintenance + electricity;

      // ~70% paid, ~20% pending, ~10% overdue
      let status, amtReceived, payDate, refNo;
      const r = idx % 10;
      if (r < 7) {
        status = 'Paid';
        amtReceived = total;
        payDate = `${String(Math.min(idx % 28 + 1, 28)).padStart(2, '0')}/06/2026`;
        refNo = `UPI${String(idx).padStart(6, '0')}`;
      } else if (r < 9) {
        status = 'Pending';
        amtReceived = 0;
        payDate = '';
        refNo = '';
      } else {
        status = 'Overdue';
        amtReceived = 0;
        payDate = '';
        refNo = '';
      }

      collectionsRows.push([flatNo, tower, status, amtReceived, payDate, refNo, '']);
    }
  }
}

const collWb = utils.book_new();
const collWs = utils.aoa_to_sheet(collectionsRows);
collWs['!cols'] = [
  { wch: 8 }, { wch: 7 }, { wch: 10 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
];

// Add a readme tab
const readmeData = [
  ['Field', 'Required', 'Format / Values', 'Notes'],
  ['Flat No', 'Yes', 'e.g. A101', 'Must match a unit in the system'],
  ['Tower', 'No', 'e.g. A', 'Used for display/filter only'],
  ['Status', 'Yes', 'Paid | Pending | Overdue', 'Case-insensitive'],
  ['Amount Received (₹)', 'If Paid', 'Number (rupees)', '0 for Pending/Overdue'],
  ['Payment Date', 'If Paid', 'DD/MM/YYYY', 'Leave blank if not paid'],
  ['Reference No', 'No', 'UPI/cheque/bank ref', ''],
  ['Notes', 'No', 'Free text', ''],
  [],
  ['Period being imported:', PERIOD, '', ''],
  ['Due date applied:', DUE_DATE, '', ''],
];
const readmeWs = utils.aoa_to_sheet(readmeData);
readmeWs['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 30 }];
utils.book_append_sheet(collWb, collWs, `Collections ${PERIOD}`);
utils.book_append_sheet(collWb, readmeWs, 'README');

const collBuf = write(collWb, { type: 'buffer', bookType: 'xlsx' });
await writeFile(join(ROOT, 'test-fixtures', `collections-sample-${PERIOD}.xlsx`), collBuf);
const paidCount = collectionsRows.slice(1).filter(r => r[2] === 'Paid').length;
console.log(`✓ collections-sample-${PERIOD}.xlsx — ${collectionsRows.length - 1} entries (${paidCount} paid)`);

console.log('\nSample files written to test-fixtures/');
