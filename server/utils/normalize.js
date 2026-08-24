/**
 * Pure string-normalization helpers used to compare contact details across
 * differently-formatted submissions (e.g. "+91 98765 43210" vs "9876543210").
 * No DB access here so this can be required from the Lead model itself
 * without creating a circular dependency with anything that queries Lead.
 */

/** Strip formatting and a leading country code so phone numbers compare equal regardless of how they were typed. */
function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  // Indian mobile numbers are 10 digits; longer strings carry a country code
  // (e.g. 91) or leading zeros that would otherwise make the same number
  // look different.
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

module.exports = { normalizePhone, normalizeEmail };
