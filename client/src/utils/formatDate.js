/**
 * Format a date as DD-MMM-YYYY (e.g. 15-Jul-2026).
 *
 * Returns null for missing or unparseable values so callers can fall back to
 * their own placeholder text.
 */
export const formatDateDDMMMYYYY = (value) => {
  if (!value) return null;

  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return null;

  // en-GB with these options yields "15 Jul 2026"; the agreement uses dashes.
  return date
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/\s/g, '-');
};

const parseDate = (value) => {
  if (value instanceof Date) return value;

  if (typeof value === 'string') {
    // The Date constructor reads a date-only string as UTC midnight, which
    // renders as the previous day anywhere west of Greenwich. Read it as a
    // local date instead, so the date shown is the date that was entered.
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
  }

  return new Date(value);
};
