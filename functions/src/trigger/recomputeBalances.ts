import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import type { TransactionDirection } from '../lib/types';

interface TxnSnapshot {
  direction: TransactionDirection;
  amountPaise: number;
  accountId: string;
  fundHead: string;
  occurredAt: Timestamp;
}

function getPeriod(ts: Timestamp): string {
  const d = ts.toDate();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function recomputeAccount(societyId: string, accountId: string): Promise<void> {
  const [accountSnap, txnsSnap] = await Promise.all([
    db.doc(`societies/${societyId}/accounts/${accountId}`).get(),
    db.collection(`societies/${societyId}/transactions`).where('accountId', '==', accountId).get(),
  ]);
  if (!accountSnap.exists) return;

  const openingBalance = (accountSnap.data()?.openingBalancePaise ?? 0) as number;
  let balance = openingBalance;
  for (const txnDoc of txnsSnap.docs) {
    const t = txnDoc.data() as TxnSnapshot;
    balance += t.direction === 'in' ? t.amountPaise : -t.amountPaise;
  }

  await db.doc(`societies/${societyId}/accounts/${accountId}`).update({
    currentBalancePaise: balance,
  });
}

async function recomputePeriod(societyId: string, period: string): Promise<void> {
  const [year, month] = period.split('-').map(Number);
  const periodStart = Timestamp.fromDate(new Date(Date.UTC(year, month - 1, 1)));
  const periodEnd   = Timestamp.fromDate(new Date(Date.UTC(year, month, 1)));

  const txnsSnap = await db
    .collection(`societies/${societyId}/transactions`)
    .where('occurredAt', '>=', periodStart)
    .where('occurredAt', '<',  periodEnd)
    .get();

  const byAccount: Record<string, { inPaise: number; outPaise: number }> = {};
  const byFund: Record<string, { inPaise: number; outPaise: number }> = {};
  let totalInPaise = 0;
  let totalOutPaise = 0;

  for (const txnDoc of txnsSnap.docs) {
    const t = txnDoc.data() as TxnSnapshot;
    if (!byAccount[t.accountId]) byAccount[t.accountId] = { inPaise: 0, outPaise: 0 };
    if (!byFund[t.fundHead])     byFund[t.fundHead]     = { inPaise: 0, outPaise: 0 };

    if (t.direction === 'in') {
      byAccount[t.accountId].inPaise += t.amountPaise;
      byFund[t.fundHead].inPaise     += t.amountPaise;
      totalInPaise += t.amountPaise;
    } else {
      byAccount[t.accountId].outPaise += t.amountPaise;
      byFund[t.fundHead].outPaise     += t.amountPaise;
      totalOutPaise += t.amountPaise;
    }
  }

  await db.doc(`societies/${societyId}/balances/${period}`).set({
    societyId,
    period,
    byAccount,
    byFund,
    totalInPaise,
    totalOutPaise,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export const recomputeBalances = onDocumentWritten(
  { document: 'societies/{societyId}/transactions/{txnId}', region: 'asia-south1' },
  async (event) => {
    const { societyId } = event.params;
    const before = event.data?.before.exists ? (event.data.before.data() as TxnSnapshot) : null;
    const after  = event.data?.after.exists  ? (event.data.after.data()  as TxnSnapshot) : null;

    const accountIds = new Set<string>();
    const periods    = new Set<string>();

    if (before) {
      accountIds.add(before.accountId);
      if (before.occurredAt) periods.add(getPeriod(before.occurredAt));
    }
    if (after) {
      accountIds.add(after.accountId);
      if (after.occurredAt) periods.add(getPeriod(after.occurredAt));
    }

    await Promise.all([
      ...[...accountIds].map(id => recomputeAccount(societyId, id)),
      ...[...periods].map(p  => recomputePeriod(societyId, p)),
    ]);
  },
);
