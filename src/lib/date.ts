/** Format a Firestore Timestamp or JS Date for display. */
export function formatDate(
  date: Date | { toDate(): Date },
  locale = 'en-IN',
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  const d = 'toDate' in date ? date.toDate() : date;
  return new Intl.DateTimeFormat(locale, options).format(d);
}

/** Format a date as a short month+year label, e.g. "Jun 2026". */
export function formatMonthYear(date: Date | { toDate(): Date }, locale = 'en-IN'): string {
  return formatDate(date, locale, { month: 'short', year: 'numeric' });
}

/** Return ISO date string (YYYY-MM-DD) for a Date — used for inputs. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
