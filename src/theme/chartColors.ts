/** Colour palettes for charts. Allowed to contain hex literals (src/theme/ is allowlisted by check:ux). */

export const SOURCE_COLOR: Record<string, string> = {
  collection:       '#2e7d32',
  vendorIncome:     '#388e3c',
  manual:           '#66bb6a',
};
export const SOURCE_COLOR_FALLBACK = '#4caf50';

export const FUND_COLOR: Record<string, string> = {
  general:  '#1565c0',
  sinking:  '#283593',
  corpus:   '#6a1b9a',
  repair:   '#bf360c',
};
export const FUND_COLOR_FALLBACK = '#1976d2';

export const EXPENSE_COLOR: Record<string, string> = {
  recurringPayment: '#e65100',
  expenseRequest:   '#bf360c',
  manual:           '#ef6c00',
  surplus:          '#00695c',
};
export const EXPENSE_COLOR_FALLBACK = '#f57c00';
