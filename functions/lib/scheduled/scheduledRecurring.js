"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRecurringInstances = exports.scheduledRecurring = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
/** Days in a given month (1-indexed). */
function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
/** Current period as "YYYY-MM" in IST. */
function currentPeriodIST() {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
}
async function generateForSociety(societyId, period) {
    const [year, month] = period.split('-').map(Number);
    const templatesSnap = await admin_1.db
        .collection(`societies/${societyId}/recurringPayments`)
        .where('active', '==', true)
        .get();
    let created = 0;
    for (const templateDoc of templatesSnap.docs) {
        const t = templateDoc.data();
        if (t.startYearMonth > period)
            continue;
        if (t.endYearMonth && t.endYearMonth < period)
            continue;
        const instanceId = `${templateDoc.id}_${period}`;
        const instanceRef = admin_1.db.doc(`societies/${societyId}/recurringInstances/${instanceId}`);
        // Idempotent: skip if already exists
        const existing = await instanceRef.get();
        if (existing.exists)
            continue;
        // Clamp dueDay to the last day of the month (e.g. Feb 28/29)
        const maxDay = daysInMonth(year, month);
        const dueDay = Math.min(t.dueDay, maxDay);
        const dueDate = `${period}-${String(dueDay).padStart(2, '0')}`;
        const doc = {
            id: instanceId,
            societyId,
            recurringPaymentId: templateDoc.id,
            period,
            name: t.name,
            category: t.category,
            amountPaise: t.amountPaise,
            dueDate,
            fundHead: t.fundHead,
            accountId: t.accountId,
            status: 'pending',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        };
        if (t.vendorId)
            doc.vendorId = t.vendorId;
        await instanceRef.set(doc);
        created++;
    }
    return created;
}
/** Cron: runs at 00:00 IST on the 1st of every month. */
exports.scheduledRecurring = (0, scheduler_1.onSchedule)({ schedule: '0 0 1 * *', timeZone: 'Asia/Kolkata', region: 'asia-south1' }, async () => {
    const period = currentPeriodIST();
    const societiesSnap = await admin_1.db.collection('societies').get();
    let total = 0;
    for (const societyDoc of societiesSnap.docs) {
        total += await generateForSociety(societyDoc.id, period);
    }
    console.log(`scheduledRecurring: generated ${total} instances for period ${period}`);
});
/** Admin callable: generate instances for a specific society + period (for testing/backfill). */
exports.generateRecurringInstances = (0, https_1.onCall)({ region: 'asia-south1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Not signed in.');
    const token = request.auth?.token;
    const societyId = token?.societyId;
    const role = token?.role;
    if (!societyId)
        throw new https_1.HttpsError('failed-precondition', 'No active society.');
    if (role !== 'admin')
        throw new https_1.HttpsError('permission-denied', 'Admin only.');
    const { period } = request.data;
    const targetPeriod = period ?? currentPeriodIST();
    if (!targetPeriod.match(/^\d{4}-\d{2}$/))
        throw new https_1.HttpsError('invalid-argument', 'period must be "YYYY-MM".');
    const created = await generateForSociety(societyId, targetPeriod);
    return { period: targetPeriod, created };
});
