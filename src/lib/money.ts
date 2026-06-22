// All amounts are stored as integer paise. Never use floats for money math.

/** Convert a rupee display string/number (e.g. 1234.50) to integer paise. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Convert integer paise to rupees (for display only). */
export function fromPaise(paise: number): number {
  return paise / 100;
}

/**
 * Format integer paise as a locale ₹ string.
 * Always pass paise; never pass rupee floats.
 */
export function formatMoney(paise: number, locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/** Add two paise amounts safely (integer math). */
export function addPaise(a: number, b: number): number {
  return a + b;
}

/** Subtract two paise amounts safely (integer math). */
export function subtractPaise(a: number, b: number): number {
  return a - b;
}
