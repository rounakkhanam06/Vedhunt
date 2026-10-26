// Which client notifications also go out by email. Every event always lands in
// the client's bell; email is only for the events switched on here. The
// switches live in Settings ('client_email_notifications') so an admin can
// change them without a deploy, and fall back to these defaults.
//
// Defaults: email only what the client must act on or what is formally
// important — a new invoice, a rejected payment proof, a ticket waiting for the
// client's reply, and an agreement to sign. Confirmations and chatter stay in
// the bell.
const Settings = require('../models/Settings');

const SETTINGS_KEY = 'client_email_notifications';

const EVENTS = [
  { key: 'invoice_created', label: 'New invoice issued', hint: 'The client has a new amount to pay.', default: true },
  { key: 'payment_rejected', label: 'Payment proof rejected', hint: 'The client has to submit the proof again.', default: true },
  { key: 'ticket_pending_client', label: 'Ticket waiting for the client', hint: 'Our team needs the client’s reply to continue.', default: true },
  { key: 'agreement_updated', label: 'Agreement ready to sign', hint: 'Terms were created or changed and need acceptance.', default: true },
  { key: 'payment_approved', label: 'Payment verified', hint: 'Receipt-style confirmation that a payment was accepted.', default: false },
  { key: 'ticket_reply', label: 'Reply on a support ticket', hint: 'Every staff reply on a ticket.', default: false },
  { key: 'ticket_closed', label: 'Ticket resolved or closed', hint: 'Status updates that need no action.', default: false },
];

const KEYS = new Set(EVENTS.map((e) => e.key));
const defaults = () => Object.fromEntries(EVENTS.map((e) => [e.key, e.default]));

/** Stored switches over the defaults; unknown keys and non-booleans are ignored. */
function mergePolicy(stored) {
  const policy = defaults();
  for (const [k, v] of Object.entries(stored || {})) {
    if (KEYS.has(k) && typeof v === 'boolean') policy[k] = v;
  }
  return policy;
}

async function getEmailPolicy() {
  const doc = await Settings.findOne({ key: SETTINGS_KEY }).lean();
  return mergePolicy(doc?.value);
}

/** @returns {{ policy?: object, error?: string }} */
async function saveEmailPolicy(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Send the email switches as an object of true/false values.' };
  const bad = Object.entries(input).find(([k, v]) => KEYS.has(k) && typeof v !== 'boolean');
  if (bad) return { error: `"${bad[0]}" must be true or false.` };
  const policy = mergePolicy(input);
  await Settings.findOneAndUpdate({ key: SETTINGS_KEY }, { $set: { value: policy } }, { upsert: true });
  return { policy };
}

/** Whether `event` should be emailed. Unknown events are never emailed. */
async function shouldEmail(event) {
  if (!KEYS.has(event)) return false;
  return (await getEmailPolicy())[event];
}

module.exports = { EVENTS, getEmailPolicy, saveEmailPolicy, shouldEmail, mergePolicy };
