import { HttpsError } from 'firebase-functions/v2/https';
import type { PaymentMode } from './types';

export const VALID_PAYMENT_MODES = new Set<PaymentMode>(['cash', 'upi', 'cheque', 'bank']);

export function requirePositivePaise(value: unknown, field: string): void {
  if (!Number.isInteger(value) || (value as number) <= 0)
    throw new HttpsError('invalid-argument', `${field} must be a positive integer.`);
}

export function requireDateString(value: unknown, field: string): void {
  if (!(value as string | undefined)?.match(/^\d{4}-\d{2}-\d{2}$/))
    throw new HttpsError('invalid-argument', `${field} must be "YYYY-MM-DD".`);
}

export function requirePaymentMode(value: unknown, field: string): void {
  if (!VALID_PAYMENT_MODES.has(value as PaymentMode))
    throw new HttpsError('invalid-argument', `${field} must be cash, upi, cheque, or bank.`);
}
