// The one list of services Vedhunt sells, edited by the admin (Settings → Services) and used by
// both client profiles (services taken) and invoice lines (what a line's revenue is for), so the
// Financial Overview's "revenue by service" adds up the same names everywhere.
//
// Stored as Settings key 'service_catalog' → { services: [names] }. The first read seeds it with
// the dashboard's five services plus every service already on a client profile, so no existing
// profile value is left out of the list (the onboarding checklist also reads those names).
// Removing a name from the list never rewrites records that already use it.
const Settings = require('../models/Settings');
const Client = require('../models/Client');

const KEY = 'service_catalog';
const DEFAULT_SERVICES = ['Performance Marketing', 'Website Development', 'Accounting & Finance', 'MIS & Dashboard', 'Other'];
const MAX_SERVICES = 40;
const UNASSIGNED = 'Unassigned';

/** Names in the order given, trimmed, without blanks or case-insensitive duplicates. */
function cleanNames(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const name = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

async function getServiceList() {
  const doc = await Settings.findOne({ key: KEY }).lean();
  if (doc?.value?.services?.length) return doc.value.services;
  const used = await Client.distinct('profile.services');
  const extra = cleanNames(used).filter((s) => !DEFAULT_SERVICES.some((d) => d.toLowerCase() === s.toLowerCase()));
  // Keep "Other" last
  const services = [...DEFAULT_SERVICES.slice(0, -1), ...extra.sort(), 'Other'];
  await Settings.updateOne({ key: KEY }, { $setOnInsert: { key: KEY, value: { services } } }, { upsert: true });
  const saved = await Settings.findOne({ key: KEY }).lean();
  return saved?.value?.services || services;
}

/** @returns {{ services } | { error }} */
async function setServiceList(input) {
  const services = cleanNames(input);
  if (!services.length) return { error: 'Add at least one service.' };
  if (services.length > MAX_SERVICES) return { error: `The list can have at most ${MAX_SERVICES} services.` };
  if (services.some((s) => s.length > 80)) return { error: 'Service names can be at most 80 characters.' };
  if (services.some((s) => s.toLowerCase() === UNASSIGNED.toLowerCase())) return { error: `"${UNASSIGNED}" is reserved for invoice lines without a service.` };
  await Settings.updateOne({ key: KEY }, { $set: { value: { services } } }, { upsert: true });
  return { services };
}

/** A line's service as stored: trimmed, or undefined for none. */
const lineService = (value) => {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  return s && s.toLowerCase() !== UNASSIGNED.toLowerCase() ? s : undefined;
};

module.exports = { getServiceList, setServiceList, cleanNames, lineService, DEFAULT_SERVICES, UNASSIGNED };
