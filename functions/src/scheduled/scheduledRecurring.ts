import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';

interface TemplateData {
  name: string;
  category: string;
  vendorId?: string;
  amountPaise: number;
  dueDay: number;
  fundHead: string;
  accountId: string;
  active: boolean;
  startYearMonth: string;
  endYearMonth?: string;
}

/** Days in a given month (1-indexed). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Current period as "YYYY-MM" in IST. */
function currentPeriodIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function generateForSociety(societyId: string, period: string): Promise<number> {
  const [year, month] = period.split('-').map(Number);

  const templatesSnap = await db
    .collection(`societies/${societyId}/recurringPayments`)
    .where('active', '==', true)
    .get();

  let created = 0;

  for (const templateDoc of templatesSnap.docs) {
    const t = templateDoc.data() as TemplateData;

    if (t.startYearMonth > period) continue;
    if (t.endYearMonth && t.endYearMonth < period) continue;

    const instanceId = `${templateDoc.id}_${period}`;
    const instanceRef = db.doc(`societies/${societyId}/recurringInstances/${instanceId}`);

    // Idempotent: skip if already exists
    const existing = await instanceRef.get();
    if (existing.exists) continue;

    // Clamp dueDay to the last day of the month (e.g. Feb 28/29)
    const maxDay = daysInMonth(year, month);
    const dueDay = Math.min(t.dueDay, maxDay);
    const dueDate = `${period}-${String(dueDay).padStart(2, '0')}`;

    const doc: Record<string, unknown> = {
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
      createdAt: FieldValue.serverTimestamp(),
    };
    if (t.vendorId) doc.vendorId = t.vendorId;

    await instanceRef.set(doc);
    created++;
  }

  return created;
}

/** Cron: runs at 00:00 IST on the 1st of every month. */
export const scheduledRecurring = onSchedule(
  { schedule: '0 0 1 * *', timeZone: 'Asia/Kolkata' },
  async () => {
    const period = currentPeriodIST();
    const societiesSnap = await db.collection('societies').get();

    let total = 0;
    for (const societyDoc of societiesSnap.docs) {
      total += await generateForSociety(societyDoc.id, period);
    }
    console.log(`scheduledRecurring: generated ${total} instances for period ${period}`);
  },
);

/** Admin callable: generate instances for a specific society + period (for testing/backfill). */
export const generateRecurringInstances = onCall(
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Not signed in.');

    const token = request.auth?.token as Record<string, unknown> | undefined;
    const societyId = token?.societyId as string | undefined;
    const role = token?.role as string | undefined;

    if (!societyId) throw new HttpsError('failed-precondition', 'No active society.');
    if (role !== 'admin') throw new HttpsError('permission-denied', 'Admin only.');

    const { period } = request.data as { period?: string };
    const targetPeriod = period ?? currentPeriodIST();

    if (!targetPeriod.match(/^\d{4}-\d{2}$/))
      throw new HttpsError('invalid-argument', 'period must be "YYYY-MM".');

    const created = await generateForSociety(societyId, targetPeriod);
    return { period: targetPeriod, created };
  },
);
