"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDashboardData = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const MONTHS = [
    '2026-01', '2026-02', '2026-03',
    '2026-04', '2026-05', '2026-06',
];
// Slightly vary amounts per month to make charts look natural
const JITTER = (base, i) => Math.round(base * (1 + (((i * 37 + 13) % 17) - 8) / 100));
exports.seedDashboardData = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.token?.superAdmin)
        throw new https_1.HttpsError('permission-denied', 'Super-admin only.');
    const { societyId } = request.data;
    if (!societyId?.trim())
        throw new https_1.HttpsError('invalid-argument', 'societyId required.');
    // Load accounts and fund heads
    const [accSnap, fhSnap] = await Promise.all([
        admin_1.db.collection(`societies/${societyId}/accounts`).get(),
        admin_1.db.collection(`societies/${societyId}/fundHeads`).get(),
    ]);
    if (accSnap.empty)
        throw new https_1.HttpsError('failed-precondition', 'No accounts found in this society. Create at least one account first.');
    const accounts = accSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const mainAcc = accounts.find(a => a.type === 'bank' || a.type === 'cash') ?? accounts[0];
    const sinkingAcc = accounts.find(a => a.type === 'sinking') ?? mainAcc;
    const fhCodes = new Set(fhSnap.docs.map(d => d.data().code));
    const hasSinking = fhCodes.has('sinking');
    const hasRepair = fhCodes.has('repair');
    const hasCorpus = fhCodes.has('corpus');
    let created = 0;
    const BATCH_SIZE = 400;
    for (let mi = 0; mi < MONTHS.length; mi++) {
        const period = MONTHS[mi];
        const [y, m] = period.split('-').map(Number);
        const ts = (day) => firestore_1.Timestamp.fromDate(new Date(Date.UTC(y, m - 1, day)));
        const txns = [
            // ── Income ──────────────────────────────────────────────────────────────
            {
                direction: 'in',
                amountPaise: JITTER(65000000, mi), // ~₹6.5L — maintenance collections
                accountId: mainAcc.id,
                fundHead: 'general',
                sourceType: 'collection',
                occurredAt: ts(5),
                mode: 'bank', referenceNo: `COL-${period}`,
            },
            ...(hasSinking ? [{
                    direction: 'in',
                    amountPaise: JITTER(8000000, mi + 1), // ~₹80k — sinking fund levy
                    accountId: sinkingAcc.id,
                    fundHead: 'sinking',
                    sourceType: 'collection',
                    occurredAt: ts(5),
                    mode: 'bank', referenceNo: `SINK-${period}`,
                }] : []),
            ...(hasCorpus ? [{
                    direction: 'in',
                    amountPaise: JITTER(2000000, mi + 2), // ~₹20k — corpus contribution
                    accountId: mainAcc.id,
                    fundHead: 'corpus',
                    sourceType: 'collection',
                    occurredAt: ts(6),
                    mode: 'bank', referenceNo: `CORP-${period}`,
                }] : []),
            {
                direction: 'in',
                amountPaise: JITTER(7500000, mi + 3), // ~₹75k — vendor/shop income
                accountId: mainAcc.id,
                fundHead: 'general',
                sourceType: 'vendorIncome',
                occurredAt: ts(10),
                mode: 'bank', referenceNo: `VEND-${period}`,
            },
            // ── Expenses ─────────────────────────────────────────────────────────────
            {
                direction: 'out',
                amountPaise: JITTER(1500000, mi + 4), // ~₹15k — security guard
                accountId: mainAcc.id,
                fundHead: 'general',
                sourceType: 'recurringPayment',
                occurredAt: ts(28),
                mode: 'bank', referenceNo: `REC-SEC-${period}`,
            },
            {
                direction: 'out',
                amountPaise: JITTER(8500000, mi + 5), // ~₹85k — housekeeping
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
                amountPaise: JITTER(3000000, mi + 7), // ~₹30k — water
                accountId: mainAcc.id,
                fundHead: 'general',
                sourceType: 'recurringPayment',
                occurredAt: ts(28),
                mode: 'bank', referenceNo: `REC-WTR-${period}`,
            },
            ...(hasRepair ? [{
                    direction: 'out',
                    amountPaise: JITTER(5000000, mi + 8), // ~₹50k — maintenance repair
                    accountId: mainAcc.id,
                    fundHead: 'repair',
                    sourceType: 'expenseRequest',
                    occurredAt: ts(15),
                    mode: 'bank', referenceNo: `EXP-REP-${period}`,
                }] : []),
            ...(hasSinking ? [{
                    direction: 'out',
                    amountPaise: JITTER(5000000, mi + 9), // ~₹50k — sinking fund use
                    accountId: sinkingAcc.id,
                    fundHead: 'sinking',
                    sourceType: 'expenseRequest',
                    occurredAt: ts(20),
                    mode: 'bank', referenceNo: `EXP-SINK-${period}`,
                }] : []),
        ];
        // Write in batches
        for (let i = 0; i < txns.length; i += BATCH_SIZE) {
            const batch = admin_1.db.batch();
            for (const txn of txns.slice(i, i + BATCH_SIZE)) {
                const ref = admin_1.db.collection(`societies/${societyId}/transactions`).doc();
                batch.set(ref, { ...txn, societyId, createdBy: 'seed' });
                created++;
            }
            await batch.commit();
        }
    }
    return { created, months: MONTHS.length };
});
