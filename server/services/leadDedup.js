const Lead = require('../models/Lead');
const { normalizePhone, normalizeEmail } = require('../utils/normalize');

/**
 * Cross-channel duplicate check. A new submission is a duplicate of an
 * existing lead if it shares a phone, altPhone, or email with that lead, in
 * any combination — checked globally across every platform and leadType so
 * the same person is recognized however and wherever they got in touch.
 *
 * Every lead-creation path (website form, Facebook, Google, polling backfill)
 * calls this before writing to the DB.
 *
 * @returns the matching existing Lead document, or null.
 */
async function findDuplicateLead({ phone, altPhone, email, excludeId } = {}) {
  const phones = [...new Set([normalizePhone(phone), normalizePhone(altPhone)].filter(Boolean))];
  const emailNorm = normalizeEmail(email);

  const or = [];
  if (phones.length) {
    or.push({ phoneNormalized: { $in: phones } });
    or.push({ altPhoneNormalized: { $in: phones } });
  }
  if (emailNorm) {
    or.push({ emailNormalized: emailNorm });
  }
  if (!or.length) return null;

  const query = { $or: or };
  if (excludeId) query._id = { $ne: excludeId };

  return Lead.findOne(query);
}

module.exports = { findDuplicateLead };
