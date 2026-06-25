import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { PaymentMode, TransactionDirection, TransactionSourceType } from './types';

export interface BuildTransactionParams {
  txnId: string;
  societyId: string;
  direction: TransactionDirection;
  amountPaise: number;
  accountId: string;
  fundHead: string;
  mode: PaymentMode;
  description: string;
  occurredAt: Timestamp;
  sourceType: TransactionSourceType;
  sourceId: string;
  createdBy: string;
  referenceNo?: string;
  notes?: string;
}

export function buildTransaction(p: BuildTransactionParams): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    id: p.txnId,
    societyId: p.societyId,
    direction: p.direction,
    amountPaise: p.amountPaise,
    accountId: p.accountId,
    fundHead: p.fundHead,
    mode: p.mode,
    description: p.description,
    occurredAt: p.occurredAt,
    sourceType: p.sourceType,
    sourceId: p.sourceId,
    createdBy: p.createdBy,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (p.referenceNo?.trim()) doc.referenceNo = p.referenceNo.trim();
  if (p.notes?.trim()) doc.notes = p.notes.trim();
  return doc;
}
