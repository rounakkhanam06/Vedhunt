// Client Service Agreement versioning.
//
// There is ONE common agreement template (client/src/client/components/
// AgreementTemplate.jsx); each client only differs by their agreementDetails
// (dates, domain, service, fees, deliverables...). A client must (re)sign
// whenever the version required of them is higher than the one they accepted.
//
// Required version = max(latest global Agreement doc version, the client's own
// agreementVersion) — the client's counter is bumped every time an admin
// changes their details, the global one if the common template is re-issued.
// Pure functions only, so the rules are unit-testable (tests/agreementVersioning.test.js).

// Fields in agreementDetails that have NO schema default — if any of them is
// set, an admin has filled this client's agreement in. (Fees, service name,
// platforms etc. all have defaults in models/Client.js, so they prove nothing.)
const ADMIN_ONLY_FIELDS = ['domain', 'agreementDate', 'effectiveDate'];

// Has an admin prepared this client's agreement? Until then there is nothing
// meaningful to sign (the template would be full of placeholders/defaults).
const isAgreementConfigured = (client) => {
  if (!client) return false;
  if ((client.agreementVersion || 0) > 0) return true;
  // Already signed something before versioning existed — keep showing it
  if ((client.acceptedAgreementVersion || 0) > 0) return true;
  const d = client.agreementDetails || {};
  return ADMIN_ONLY_FIELDS.some((f) => Boolean(d[f]));
};

const requiredAgreementVersion = (client, globalVersion = 0) => {
  if (!isAgreementConfigured(client)) return 0;
  return Math.max(1, client.agreementVersion || 0, globalVersion || 0);
};

const needsAgreementAcceptance = (client, globalVersion = 0) =>
  (client?.acceptedAgreementVersion || 0) < requiredAgreementVersion(client, globalVersion);

// Version to stamp after an admin changes the details — always above what the
// client already accepted, so they are asked to sign again. (A higher global
// version is already covered by requiredAgreementVersion taking the max.)
const nextAgreementVersion = (client) =>
  Math.max(client?.agreementVersion || 0, client?.acceptedAgreementVersion || 0) + 1;

const normalizeDetails = (details = {}) => {
  const out = {};
  for (const key of Object.keys(details).sort()) {
    if (key === '_id') continue;
    const v = details[key];
    if (v instanceof Date) out[key] = v.toISOString();
    else if (Array.isArray(v)) out[key] = v.map((x) => String(x).trim()).filter(Boolean);
    else if (v === undefined || v === null || v === '') continue;
    else out[key] = v;
  }
  return out;
};

const agreementDetailsChanged = (before, after) =>
  JSON.stringify(normalizeDetails(before)) !== JSON.stringify(normalizeDetails(after));

module.exports = {
  isAgreementConfigured,
  requiredAgreementVersion,
  needsAgreementAcceptance,
  nextAgreementVersion,
  agreementDetailsChanged,
};
