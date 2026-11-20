// KPI metric catalog = the built-in METRIC_DEFS (models/KPITarget.js) plus custom KPIs the
// admin creates from KPI Goal Assigner, so each designation can be measured on its own KPIs
// (client request, Nov 2026). Custom KPIs are always manual: the manager enters the actual
// value, and they count in the KPI score like any other metric.
//
// Stored as Settings key 'kpi_custom_metrics' → { metrics: [{ key, label, unit, lowerIsBetter, archived }] }.
// Removing a custom KPI only archives it: KPIs already assigned with it keep their name and score.
const Settings = require('../models/Settings');
const { METRIC_DEFS } = require('../models/KPITarget');

const KEY = 'kpi_custom_metrics';
const UNITS = ['count', '%', '₹', 'hrs', 'score', 'x', 'days'];
const MAX_CUSTOM = 100;

async function listCustom() {
  const doc = await Settings.findOne({ key: KEY }).lean();
  return Array.isArray(doc?.value?.metrics) ? doc.value.metrics : [];
}

const toDef = (m) => ({
  label: m.label, unit: m.unit, auto: false, source: 'Custom KPI — manual entry',
  lowerIsBetter: Boolean(m.lowerIsBetter), custom: true, archived: Boolean(m.archived),
});

/** Every metric definition (built-in + custom, archived included so old KPIs keep their labels). */
async function getMetricDefs() {
  const defs = { ...METRIC_DEFS };
  for (const m of await listCustom()) defs[m.key] = toDef(m);
  return defs;
}

/** Metric keys that can be picked for new KPIs (archived custom ones left out). */
const selectableTypes = (defs) => Object.keys(defs).filter((k) => !defs[k].archived);

async function createCustom({ label, unit, lowerIsBetter } = {}) {
  const name = String(label || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 60) return { error: 'Enter a KPI name of 2–60 characters.' };
  if (!UNITS.includes(unit)) return { error: `Choose a unit: ${UNITS.join(', ')}.` };
  const metrics = await listCustom();
  const lower = name.toLowerCase();
  const clash = Object.values(METRIC_DEFS).some((d) => d.label.toLowerCase() === lower)
    || metrics.some((m) => !m.archived && m.label.toLowerCase() === lower);
  if (clash) return { error: 'A KPI with this name already exists.' };
  if (metrics.filter((m) => !m.archived).length >= MAX_CUSTOM) return { error: `You can have up to ${MAX_CUSTOM} custom KPIs.` };

  const metric = { key: `custom_${Date.now().toString(36)}`, label: name, unit, lowerIsBetter: Boolean(lowerIsBetter), archived: false, createdAt: new Date() };
  await Settings.updateOne({ key: KEY }, { $push: { 'value.metrics': metric } }, { upsert: true });
  return { metric };
}

async function archiveCustom(key) {
  const res = await Settings.updateOne({ key: KEY, 'value.metrics.key': key }, { $set: { 'value.metrics.$.archived': true } });
  return res.matchedCount ? { ok: true } : { error: 'Custom KPI not found.' };
}

module.exports = { getMetricDefs, selectableTypes, createCustom, archiveCustom, listCustom, UNITS };
