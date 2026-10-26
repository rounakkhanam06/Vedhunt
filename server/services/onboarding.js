// Onboarding checklist and go-live gate (Client Portal CRM §4).
// A campaign can only be marked live once every launch-critical step that
// applies to the client is Completed (or Not Applicable with a reason) — or an
// authorised person records a logged exception. Steps are built from
// service/platform templates, so a client without Meta never gets Meta steps.
const mongoose = require('mongoose');
const OnboardingChecklist = require('../models/OnboardingChecklist');
const Client = require('../models/Client');

const DONE = ['Completed', 'Not Applicable'];

const ADS_SERVICES = ['Performance Marketing', 'Digital Marketing'];
const has = (list, name) => (list || []).some((x) => String(x).toLowerCase() === name.toLowerCase());
const hasAny = (list, names) => names.some((n) => has(list, n));
// "Meta" / "Meta Ads" / "Facebook" / "Instagram" all mean the Meta platform
const usesMeta = (platforms) => (platforms || []).some((p) => /meta|facebook|instagram/i.test(p));
const usesGoogle = (platforms) => (platforms || []).some((p) => /google/i.test(p));

/**
 * The twelve source steps. `applies({ services, platforms })` decides whether a
 * step is relevant for this client; `campaign_live` is the gated transition
 * itself, not a prerequisite, so it is never launch-critical.
 */
const TEMPLATE = [
  { key: 'contract_signed', label: 'Contract / NDA / SOW Signed', needsEvidence: true, applies: () => true },
  { key: 'advance_payment', label: 'Advance Payment Received', needsEvidence: true, applies: () => true },
  { key: 'meta_access', label: 'Meta Business Manager Access Granted', needsEvidence: true, applies: ({ platforms }) => usesMeta(platforms) },
  { key: 'google_ads_access', label: 'Google Ads Account Access Granted', needsEvidence: true, applies: ({ platforms }) => usesGoogle(platforms) },
  {
    key: 'website_access', label: 'Website / Landing Page Access Granted', needsEvidence: true,
    applies: ({ services }) => hasAny(services, [...ADS_SERVICES, 'Website Development']),
  },
  { key: 'meta_pixel_capi', label: 'Meta Pixel & CAPI Installed (event_id dedup checked)', needsEvidence: true, applies: ({ platforms }) => usesMeta(platforms) },
  { key: 'google_tracking', label: 'Google Tag / Conversion Tracking Installed', needsEvidence: true, applies: ({ platforms }) => usesGoogle(platforms) },
  {
    key: 'creative_approved', label: 'Creative Assets Approved by Client', needsEvidence: true,
    applies: ({ services }) => hasAny(services, [...ADS_SERVICES, 'Social Media Management']),
  },
  {
    key: 'strategy_shared', label: 'Campaign Strategy Document Shared with Client', needsEvidence: true,
    applies: ({ services }) => hasAny(services, ADS_SERVICES),
  },
  { key: 'test_events_removed', label: 'Test Events Removed (META_TEST_EVENT_CODE cleared)', needsEvidence: true, applies: ({ platforms }) => usesMeta(platforms) },
];

/** Which template steps apply to a client with these services and platforms. */
function applicableTemplate(scope = {}) {
  return TEMPLATE.filter((t) => t.applies({ services: scope.services || [], platforms: scope.platforms || [] }));
}

const newItem = (t) => ({ key: t.key, label: t.label, launchCritical: true, needsEvidence: !!t.needsEvidence, status: 'Not Started' });

/**
 * Items to add so the checklist covers the current services/platforms. Never
 * removes or resets an existing step — a client dropping Meta later keeps its
 * history; the open Meta steps can be set to Not Applicable with a reason.
 */
function missingItems(existingItems, scope) {
  const have = new Set((existingItems || []).map((i) => i.key));
  return applicableTemplate(scope).filter((t) => !have.has(t.key)).map(newItem);
}

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/** True when a step is past its due date and not finished. */
const isItemOverdue = (item, now = new Date()) =>
  !!item.dueDate && !DONE.includes(item.status) && new Date(item.dueDate).getTime() < now.getTime();

/**
 * Launch-critical steps still standing between the client and go-live, each
 * with the reason it blocks (so the UI can name exactly what is missing).
 */
function launchBlockers(items, now = new Date()) {
  return (items || [])
    .filter((i) => i.launchCritical && !DONE.includes(i.status))
    .map((i) => ({
      key: i.key,
      label: i.label,
      status: i.status,
      reason: i.status === 'Blocked' ? (i.blocker || 'Blocked') : i.status === 'In Progress' ? 'In progress' : 'Not started',
      overdue: isItemOverdue(i, now),
      owner: i.owner || null,
      dueDate: i.dueDate || null,
    }));
}

/** Validates a step update; returns { value, errors } where value is what may be written. */
function validateItemUpdate(item, input = {}) {
  const errors = [];
  const value = {};
  const next = { ...item, ...input };

  if (input.status !== undefined) {
    if (!OnboardingChecklist.ITEM_STATUSES.includes(input.status)) errors.push(`Status must be one of ${OnboardingChecklist.ITEM_STATUSES.join(', ')}`);
    else value.status = input.status;
  }
  for (const f of ['remarks', 'evidenceLink', 'blocker', 'naReason']) {
    if (input[f] !== undefined) value[f] = String(input[f] || '').trim();
  }
  if (input.clientMessage !== undefined) {
    const msg = String(input.clientMessage || '').trim();
    if (msg.length > 300) errors.push('The message for the client can be at most 300 characters.');
    else value.clientMessage = msg;
  }
  if (input.shareProof !== undefined) value.shareProof = input.shareProof === true;
  if (input.owner !== undefined) {
    if (input.owner && !mongoose.Types.ObjectId.isValid(input.owner)) errors.push('Invalid owner');
    else value.owner = input.owner || null;
  }
  if (input.dueDate !== undefined) {
    const d = input.dueDate ? new Date(input.dueDate) : null;
    if (d && Number.isNaN(d.getTime())) errors.push('Invalid due date');
    else value.dueDate = d;
  }

  const status = value.status ?? item.status;
  const merged = { ...next, ...value };
  // Sharing a proof link with the client needs a real https link — never free text or a script URL
  if (merged.shareProof === true && !/^https:\/\/\S+$/i.test(String(merged.evidenceLink || '').trim())) {
    errors.push('To show the proof to the client, add a link that starts with https://');
  }
  if (status === 'Not Applicable' && !String(merged.naReason || '').trim()) errors.push('A reason is required to mark a step Not Applicable');
  if (status === 'Blocked' && !String(merged.blocker || '').trim()) errors.push('Say what is blocking this step');
  if (status === 'Completed' && item.needsEvidence && !String(merged.evidenceLink || '').trim() && !String(merged.remarks || '').trim()) {
    errors.push('Add evidence (a link) or remarks before marking this step Completed');
  }
  return { value, errors };
}

/**
 * What a client may see of their checklist — status words, a message they were
 * sent, and proof links staff chose to share. Never remarks, blockers, owners,
 * due dates, internal reasons or exception details.
 */
function clientView(doc) {
  if (!doc || !doc.items?.length) return null;
  const items = doc.items.map((i) => {
    const done = i.status === 'Completed';
    const notNeeded = i.status === 'Not Applicable';
    const waiting = !!i.clientMessage && !done && !notNeeded;
    const state = done ? 'done' : notNeeded ? 'not_needed' : waiting ? 'waiting_on_you' : i.status === 'Blocked' ? 'blocked' : i.status === 'In Progress' ? 'in_progress' : 'not_started';
    const link = String(i.evidenceLink || '').trim();
    return {
      key: i.key,
      label: i.label,
      state,
      message: waiting ? i.clientMessage : '',
      completedAt: done ? i.completedAt || null : null,
      proofUrl: i.shareProof && /^https:\/\/\S+$/i.test(link) ? link : null,
    };
  });
  return {
    items,
    summary: {
      total: items.length,
      done: items.filter((i) => i.state === 'done' || i.state === 'not_needed').length,
      waitingOnYou: items.filter((i) => i.state === 'waiting_on_you').length,
    },
    live: !!doc.goLive?.isLive,
    liveDate: doc.goLive?.isLive ? doc.goLive.liveDate || null : null,
  };
}

/** Load a client's checklist, creating it from the template on first use. */
async function getOrCreateChecklist(clientId) {
  let doc = await OnboardingChecklist.findOne({ client_ref: clientId });
  if (doc) return doc;
  const client = await Client.findById(clientId, 'profile.services profile.platforms').lean();
  if (!client) return null;
  const scope = { services: client.profile?.services || [], platforms: client.profile?.platforms || [] };
  doc = await OnboardingChecklist.create({ client_ref: clientId, scope, items: missingItems([], scope) });
  return doc;
}

/** Add any steps the client's current services/platforms now require. Returns the number added. */
async function syncChecklist(doc) {
  const client = await Client.findById(doc.client_ref, 'profile.services profile.platforms').lean();
  const scope = { services: client?.profile?.services || [], platforms: client?.profile?.platforms || [] };
  const add = missingItems(doc.items, scope);
  doc.scope = scope;
  if (add.length) doc.items.push(...add);
  if (add.length || doc.isModified('scope')) await doc.save();
  return add.length;
}

/**
 * The go-live decision. Pure so it can be tested: given the checklist items and
 * the request, returns what should happen.
 *   { allowed: true }                          – no blockers
 *   { allowed: true, exception: {...} }        – blockers waived by an authorised person
 *   { allowed: false, blockers }               – stopped, with the exact items
 *   { allowed: false, error }                  – exception asked for but not valid / not permitted
 */
function evaluateGoLive(items, { exception, canAuthoriseException } = {}, now = new Date()) {
  const blockers = launchBlockers(items, now);
  if (!blockers.length) return { allowed: true };
  if (!exception) return { allowed: false, blockers };
  if (!canAuthoriseException) return { allowed: false, blockers, error: 'Only an authorised user can approve a go-live exception.' };
  const reason = String(exception.reason || '').trim();
  if (reason.length < 10) return { allowed: false, blockers, error: 'An exception needs a written reason (at least 10 characters).' };
  return { allowed: true, exception: { reason, waivedItems: blockers.map((b) => b.key) } };
}

/** Steps overdue or blocked across live-pending checklists, for the daily alert job. */
async function findAlertableItems(now = new Date()) {
  const lists = await OnboardingChecklist.find({ 'goLive.isLive': false, 'items.0': { $exists: true } }).lean();
  const out = [];
  for (const list of lists) {
    for (const item of list.items) {
      if (!item.launchCritical || DONE.includes(item.status)) continue;
      const overdue = isItemOverdue(item, now);
      if (item.status !== 'Blocked' && !overdue) continue;
      if (item.lastAlertedOn === dayKey(now)) continue;
      out.push({ checklistId: list._id, client_ref: list.client_ref, item, overdue, blocked: item.status === 'Blocked' });
    }
  }
  return out;
}

module.exports = {
  TEMPLATE, DONE, applicableTemplate, missingItems, isItemOverdue, launchBlockers, validateItemUpdate,
  getOrCreateChecklist, syncChecklist, clientView, evaluateGoLive, findAlertableItems, dayKey,
};
