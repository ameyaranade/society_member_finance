"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeBalances = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
function getPeriod(ts) {
    const d = ts.toDate();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
async function recomputeAccount(societyId, accountId) {
    const [accountSnap, txnsSnap] = await Promise.all([
        admin_1.db.doc(`societies/${societyId}/accounts/${accountId}`).get(),
        admin_1.db.collection(`societies/${societyId}/transactions`).where('accountId', '==', accountId).get(),
    ]);
    if (!accountSnap.exists)
        return;
    const openingBalance = (accountSnap.data()?.openingBalancePaise ?? 0);
    let balance = openingBalance;
    for (const txnDoc of txnsSnap.docs) {
        const t = txnDoc.data();
        balance += t.direction === 'in' ? t.amountPaise : -t.amountPaise;
    }
    await admin_1.db.doc(`societies/${societyId}/accounts/${accountId}`).update({
        currentBalancePaise: balance,
    });
}
async function recomputePeriod(societyId, period) {
    const [year, month] = period.split('-').map(Number);
    const periodStart = firestore_2.Timestamp.fromDate(new Date(Date.UTC(year, month - 1, 1)));
    const periodEnd = firestore_2.Timestamp.fromDate(new Date(Date.UTC(year, month, 1)));
    const txnsSnap = await admin_1.db
        .collection(`societies/${societyId}/transactions`)
        .where('occurredAt', '>=', periodStart)
        .where('occurredAt', '<', periodEnd)
        .get();
    const byAccount = {};
    const byFund = {};
    let totalInPaise = 0;
    let totalOutPaise = 0;
    for (const txnDoc of txnsSnap.docs) {
        const t = txnDoc.data();
        if (!byAccount[t.accountId])
            byAccount[t.accountId] = { inPaise: 0, outPaise: 0 };
        if (!byFund[t.fundHead])
            byFund[t.fundHead] = { inPaise: 0, outPaise: 0 };
        if (t.direction === 'in') {
            byAccount[t.accountId].inPaise += t.amountPaise;
            byFund[t.fundHead].inPaise += t.amountPaise;
            totalInPaise += t.amountPaise;
        }
        else {
            byAccount[t.accountId].outPaise += t.amountPaise;
            byFund[t.fundHead].outPaise += t.amountPaise;
            totalOutPaise += t.amountPaise;
        }
    }
    await admin_1.db.doc(`societies/${societyId}/balances/${period}`).set({
        societyId,
        period,
        byAccount,
        byFund,
        totalInPaise,
        totalOutPaise,
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    });
}
exports.recomputeBalances = (0, firestore_1.onDocumentWritten)({ document: 'societies/{societyId}/transactions/{txnId}' }, async (event) => {
    const { societyId } = event.params;
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    const accountIds = new Set();
    const periods = new Set();
    if (before) {
        accountIds.add(before.accountId);
        if (before.occurredAt)
            periods.add(getPeriod(before.occurredAt));
    }
    if (after) {
        accountIds.add(after.accountId);
        if (after.occurredAt)
            periods.add(getPeriod(after.occurredAt));
    }
    await Promise.all([
        ...[...accountIds].map(id => recomputeAccount(societyId, id)),
        ...[...periods].map(p => recomputePeriod(societyId, p)),
    ]);
});
