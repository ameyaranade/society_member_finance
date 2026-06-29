import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../lib/admin';

interface SeedInput { societyId: string; }

const MONTHS = [
  '2026-01', '2026-02', '2026-03',
  '2026-04', '2026-05', '2026-06',
];

// Slightly vary amounts per month to make charts look natural
const JITTER = (base: number, i: number) =>
  Math.round(base * (1 + (((i * 37 + 13) % 17) - 8) / 100));

export const seedDashboardData = onCall(async (request) => {
  if (!request.auth?.token?.superAdmin)
    throw new HttpsError('permission-denied', 'Super-admin only.');

  const { societyId } = request.data as SeedInput;
  if (!societyId?.trim()) throw new HttpsError('invalid-argument', 'societyId required.');

  // Seed data is only permitted for societies explicitly marked as test/sandbox.
  // This prevents accidental seeding of real societies even with a super-admin token.
  const societySnap = await db.doc(`societies/${societyId}`).get();
  const testMode = societySnap.data()?.config?.testMode === true;
  if (!testMode)
    throw new HttpsError(
      'failed-precondition',
      'Seed data can only be written to a test society (config.testMode must be true).',
    );

  // Load accounts and fund heads
  const [accSnap, fhSnap] = await Promise.all([
    db.collection(`societies/${societyId}/accounts`).get(),
    db.collection(`societies/${societyId}/fundHeads`).get(),
  ]);

  if (accSnap.empty)
    throw new HttpsError('failed-precondition', 'No accounts found in this society. Create at least one account first.');

  const accounts = accSnap.docs.map(d => ({ id: d.id, ...d.data() as { type?: string; name?: string } }));
  const mainAcc    = accounts.find(a => a.type === 'bank' || a.type === 'cash') ?? accounts[0];
  const sinkingAcc = accounts.find(a => a.type === 'sinking') ?? mainAcc;

  const fhCodes = new Set(fhSnap.docs.map(d => (d.data() as { code: string }).code));
  const hasSinking = fhCodes.has('sinking');
  const hasRepair  = fhCodes.has('repair');
  const hasCorpus  = fhCodes.has('corpus');

  let created = 0;
  const BATCH_SIZE = 400;

  for (let mi = 0; mi < MONTHS.length; mi++) {
    const period = MONTHS[mi];
    const [y, m] = period.split('-').map(Number);
    const ts = (day: number) =>
      Timestamp.fromDate(new Date(Date.UTC(y, m - 1, day)));

    const txns: Array<Record<string, unknown>> = [
      // ── Income ──────────────────────────────────────────────────────────────
      {
        direction: 'in',
        amountPaise: JITTER(65000000, mi),   // ~₹6.5L — maintenance collections
        accountId: mainAcc.id,
        fundHead: 'general',
        sourceType: 'collection',
        occurredAt: ts(5),
        mode: 'bank', referenceNo: `COL-${period}`,
      },
      ...(hasSinking ? [{
        direction: 'in',
        amountPaise: JITTER(8000000, mi + 1),  // ~₹80k — sinking fund levy
        accountId: sinkingAcc.id,
        fundHead: 'sinking',
        sourceType: 'collection',
        occurredAt: ts(5),
        mode: 'bank', referenceNo: `SINK-${period}`,
      }] : []),
      ...(hasCorpus ? [{
        direction: 'in',
        amountPaise: JITTER(2000000, mi + 2),  // ~₹20k — corpus contribution
        accountId: mainAcc.id,
        fundHead: 'corpus',
        sourceType: 'collection',
        occurredAt: ts(6),
        mode: 'bank', referenceNo: `CORP-${period}`,
      }] : []),
      {
        direction: 'in',
        amountPaise: JITTER(7500000, mi + 3),  // ~₹75k — vendor/shop income
        accountId: mainAcc.id,
        fundHead: 'general',
        sourceType: 'vendorIncome',
        occurredAt: ts(10),
        mode: 'bank', referenceNo: `VEND-${period}`,
      },
      // ── Expenses ─────────────────────────────────────────────────────────────
      {
        direction: 'out',
        amountPaise: JITTER(1500000, mi + 4),  // ~₹15k — security guard
        accountId: mainAcc.id,
        fundHead: 'general',
        sourceType: 'recurringPayment',
        occurredAt: ts(28),
        mode: 'bank', referenceNo: `REC-SEC-${period}`,
      },
      {
        direction: 'out',
        amountPaise: JITTER(8500000, mi + 5),  // ~₹85k — housekeeping
        accountId: mainAcc.id,
        fundHead: 'general',
        sourceType: 'recurringPayment',
        occurredAt: ts(28),
        mode: 'bank', referenceNo: `REC-HK-${period}`,
      },
      {
        direction: 'out',
        amountPaise: JITTER(12000000, mi + 6), // ~₹1.2L — electricity
        accountId: mainAcc.id,
        fundHead: 'general',
        sourceType: 'recurringPayment',
        occurredAt: ts(28),
        mode: 'bank', referenceNo: `REC-ELEC-${period}`,
      },
      {
        direction: 'out',
        amountPaise: JITTER(3000000, mi + 7),  // ~₹30k — water
        accountId: mainAcc.id,
        fundHead: 'general',
        sourceType: 'recurringPayment',
        occurredAt: ts(28),
        mode: 'bank', referenceNo: `REC-WTR-${period}`,
      },
      ...(hasRepair ? [{
        direction: 'out',
        amountPaise: JITTER(5000000, mi + 8),  // ~₹50k — maintenance repair
        accountId: mainAcc.id,
        fundHead: 'repair',
        sourceType: 'expenseRequest',
        occurredAt: ts(15),
        mode: 'bank', referenceNo: `EXP-REP-${period}`,
      }] : []),
      ...(hasSinking ? [{
        direction: 'out',
        amountPaise: JITTER(5000000, mi + 9),  // ~₹50k — sinking fund use
        accountId: sinkingAcc.id,
        fundHead: 'sinking',
        sourceType: 'expenseRequest',
        occurredAt: ts(20),
        mode: 'bank', referenceNo: `EXP-SINK-${period}`,
      }] : []),
    ];

    // Write in batches
    for (let i = 0; i < txns.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const txn of txns.slice(i, i + BATCH_SIZE)) {
        const ref = db.collection(`societies/${societyId}/transactions`).doc();
        batch.set(ref, { ...txn, societyId, createdBy: 'seed' });
        created++;
      }
      await batch.commit();
    }
  }

  return { created, months: MONTHS.length };
});
