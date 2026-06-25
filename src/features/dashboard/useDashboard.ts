import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLLECTIONS } from '../../lib/db';
import { useAuth } from '../auth/useAuth';
import { useAccounts } from '../settings/useAccounts';
import { useFundHeads } from '../settings/useFundHeads';
import {
  SOURCE_COLOR, SOURCE_COLOR_FALLBACK,
  FUND_COLOR, FUND_COLOR_FALLBACK,
  EXPENSE_COLOR, EXPENSE_COLOR_FALLBACK,
} from '../../theme/chartColors';

export type SourceType =
  | 'collection' | 'vendorIncome' | 'recurringPayment' | 'expenseRequest' | 'manual';

export interface TxnRow {
  id: string;
  direction: 'in' | 'out';
  amountPaise: number;
  accountId: string;
  fundHead: string;
  sourceType: SourceType;
}

export interface BalanceDoc {
  totalInPaise: number;
  totalOutPaise: number;
  byAccount: Record<string, { inPaise: number; outPaise: number }>;
  byFund: Record<string, { inPaise: number; outPaise: number }>;
}

// Sankey input types
export interface SankeyRawNode {
  id: string;
  label: string;
  color: string;
  value: number;
  column: 0 | 1 | 2;
}

export interface SankeyRawLink {
  sourceId: string;
  targetId: string;
  value: number;
}

export interface SankeyData {
  nodes: SankeyRawNode[];
  links: SankeyRawLink[];
}

// ── Label + colour maps ────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<string, string> = {
  collection:       'Maintenance Fees',
  vendorIncome:     'Vendor Income',
  manual:           'Other Income',
};

const EXPENSE_LABEL: Record<string, string> = {
  recurringPayment: 'Recurring Payments',
  expenseRequest:   'Maintenance / Repairs',
  manual:           'Other Expenses',
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboard(period: string) {
  const { societyId } = useAuth();
  const { accounts, loading: accLoading } = useAccounts();
  const { fundHeads, loading: fhLoading } = useFundHeads();

  const [balance, setBalance] = useState<BalanceDoc | null>(null);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [balLoading, setBalLoading] = useState(true);
  const [txnLoading, setTxnLoading] = useState(true);

  // Period balance rollup doc
  useEffect(() => {
    if (!societyId || !period) return;
    setBalLoading(true);
    return onSnapshot(
      doc(db, COLLECTIONS.balances(societyId), period),
      snap => { setBalance(snap.exists() ? (snap.data() as BalanceDoc) : null); setBalLoading(false); },
      () => setBalLoading(false),
    );
  }, [societyId, period]);

  // Transactions for the period (for Sankey source breakdown)
  useEffect(() => {
    if (!societyId || !period) return;
    setTxnLoading(true);
    const [year, month] = period.split('-').map(Number);
    const start = Timestamp.fromDate(new Date(Date.UTC(year, month - 1, 1)));
    const end   = Timestamp.fromDate(new Date(Date.UTC(year, month, 1)));
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.transactions(societyId)),
        where('occurredAt', '>=', start),
        where('occurredAt', '<',  end),
      ),
      snap => {
        setTxns(snap.docs.map(d => ({ id: d.id, ...d.data() } as TxnRow)));
        setTxnLoading(false);
      },
      () => setTxnLoading(false),
    );
  }, [societyId, period]);

  // Build Sankey from raw transactions
  const sankeyData = useMemo((): SankeyData | null => {
    if (!txns.length) return null;

    // Aggregate income: sourceType → fundHead → paise
    const incomeMap = new Map<string, Map<string, number>>();
    // Aggregate expense: fundHead → sourceType → paise
    const expenseMap = new Map<string, Map<string, number>>();
    const fundIn  = new Map<string, number>();
    const fundOut = new Map<string, number>();

    for (const t of txns) {
      const fund = t.fundHead || 'general';
      if (t.direction === 'in') {
        const src = t.sourceType;
        if (!incomeMap.has(src)) incomeMap.set(src, new Map());
        incomeMap.get(src)!.set(fund, (incomeMap.get(src)!.get(fund) ?? 0) + t.amountPaise);
        fundIn.set(fund, (fundIn.get(fund) ?? 0) + t.amountPaise);
      } else {
        const src = t.sourceType;
        if (!expenseMap.has(fund)) expenseMap.set(fund, new Map());
        expenseMap.get(fund)!.set(src, (expenseMap.get(fund)!.get(src) ?? 0) + t.amountPaise);
        fundOut.set(fund, (fundOut.get(fund) ?? 0) + t.amountPaise);
      }
    }

    // Build links income→fund
    const links: SankeyRawLink[] = [];
    for (const [srcType, fundMap] of incomeMap) {
      for (const [fund, value] of fundMap) {
        if (value > 0) links.push({ sourceId: `inc_${srcType}`, targetId: `fund_${fund}`, value });
      }
    }
    // Build links fund→expense
    for (const [fund, srcMap] of expenseMap) {
      for (const [srcType, value] of srcMap) {
        if (value > 0) links.push({ sourceId: `fund_${fund}`, targetId: `exp_${srcType}`, value });
      }
    }
    // Surplus per fund
    for (const [fund, inP] of fundIn) {
      const outP = fundOut.get(fund) ?? 0;
      if (inP > outP) links.push({ sourceId: `fund_${fund}`, targetId: 'exp_surplus', value: inP - outP });
    }

    if (!links.length) return null;

    // Build nodes from links
    const nodeMap = new Map<string, SankeyRawNode>();
    function ensureNode(id: string) {
      if (nodeMap.has(id)) return;
      if (id.startsWith('inc_')) {
        const key = id.slice(4);
        nodeMap.set(id, { id, label: SOURCE_LABEL[key] ?? key, color: SOURCE_COLOR[key] ?? SOURCE_COLOR_FALLBACK, value: 0, column: 0 });
      } else if (id.startsWith('fund_')) {
        const key = id.slice(5);
        const fh = fundHeads.find(f => f.code === key);
        nodeMap.set(id, { id, label: fh?.name ?? key, color: FUND_COLOR[key] ?? FUND_COLOR_FALLBACK, value: 0, column: 1 });
      } else if (id.startsWith('exp_')) {
        const key = id.slice(4);
        const label = key === 'surplus' ? 'Net Surplus' : (EXPENSE_LABEL[key] ?? key);
        nodeMap.set(id, { id, label, color: EXPENSE_COLOR[key] ?? EXPENSE_COLOR_FALLBACK, value: 0, column: 2 });
      }
    }
    for (const l of links) { ensureNode(l.sourceId); ensureNode(l.targetId); }

    // Node values: income nodes = total out; fund nodes = total in; expense nodes = total in
    for (const l of links) {
      nodeMap.get(l.sourceId)!.value += l.value;
      nodeMap.get(l.targetId)!.value += l.value;
    }

    return { nodes: [...nodeMap.values()], links };
  }, [txns, fundHeads]);

  return {
    balance,
    txns,
    accounts,
    fundHeads,
    sankeyData,
    loading: balLoading || txnLoading || accLoading || fhLoading,
  };
}
