// Admin-defined activity master for the work timer / timesheet. Each type
// carries the default Productive/Billable classification a logged session
// gets. Stored in Settings under 'activity_master'.
const Settings = require('../models/Settings');

const SETTINGS_KEY = 'activity_master';

// The list that used to be hardcoded in WorkLog's enum, so existing logs keep
// matching a master entry.
const DEFAULT_ACTIVITY_TYPES = [
  { name: 'Client Work', productive: true, billable: true },
  { name: 'Client Meeting', productive: true, billable: true },
  { name: 'Internal Meeting', productive: true, billable: false },
  { name: 'Vedhunt Task', productive: true, billable: false },
  { name: 'Development', productive: true, billable: true },
  { name: 'Testing', productive: true, billable: true },
  { name: 'Bug Fixing', productive: true, billable: true },
  { name: 'Documentation', productive: true, billable: false },
  { name: 'Research', productive: true, billable: false },
  { name: 'Training', productive: true, billable: false },
  { name: 'Break', productive: false, billable: false },
  { name: 'Other', productive: false, billable: false },
];

// Read on every timer start/stop, so keep a short in-process cache.
const CACHE_MS = 60 * 1000;
let cache = { at: 0, types: null };

function sanitize(types) {
  if (!Array.isArray(types)) return null;
  const seen = new Set();
  const clean = [];
  for (const t of types) {
    const name = String(t?.name || '').trim().slice(0, 60);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    clean.push({ name, productive: Boolean(t.productive), billable: Boolean(t.billable) });
  }
  return clean.length ? clean : null;
}

async function getActivityTypes() {
  if (cache.types && Date.now() - cache.at < CACHE_MS) return cache.types;
  const doc = await Settings.findOne({ key: SETTINGS_KEY }).lean();
  const types = sanitize(doc?.value?.types) || DEFAULT_ACTIVITY_TYPES;
  cache = { at: Date.now(), types };
  return types;
}

async function findActivityType(name) {
  const types = await getActivityTypes();
  return types.find((t) => t.name === name) || null;
}

/** @returns {{ types?: object[], error?: string }} */
async function saveActivityTypes(input) {
  const types = sanitize(input);
  if (!types) return { error: 'Provide at least one activity type with a name.' };
  await Settings.findOneAndUpdate({ key: SETTINGS_KEY }, { $set: { value: { types } } }, { upsert: true });
  cache = { at: Date.now(), types };
  return { types };
}

module.exports = { getActivityTypes, findActivityType, saveActivityTypes, DEFAULT_ACTIVITY_TYPES };
