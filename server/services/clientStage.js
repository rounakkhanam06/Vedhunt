// Client stage (Client Journey SOP §12): one status per client saying where it is in the
// journey and what is next. It is worked out from the records — never typed — so it can't
// go stale (client decision, Oct 2026).
//
// The first rule that matches wins. Account conditions come first (they override the journey),
// then the onboarding journey in the SOP's order:
//   Offboarded → Archived → Suspended → Paused (on hold) → Payment Overdue
//   → Pending Onboarding (portal not activated) → Awaiting Payment (nothing paid yet)
//   → Awaiting Agreement → KYC Pending → Access / Setup Pending → Strategy / Approval Pending
//   → Ready to Launch → Active – In Delivery
const ClientKyc = require('../models/ClientKyc');
const OnboardingChecklist = require('../models/OnboardingChecklist');
const Agreement = require('../models/Agreement');
const kyc = require('./kyc');
const { applicableTemplate } = require('./onboarding');
const { isAgreementConfigured, needsAgreementAcceptance } = require('./agreementVersioning');

const DONE = ['Completed', 'Not Applicable'];
// Onboarding steps that are the client's approvals rather than access / technical setup
const APPROVAL_STEPS = new Set(['creative_approved', 'strategy_shared']);
// Steps the payment and agreement stages already cover
const COVERED_ELSEWHERE = new Set(['advance_payment', 'contract_signed']);

const STAGES = [
  'Pending Onboarding', 'Awaiting Payment', 'Awaiting Agreement', 'KYC Pending', 'Access / Setup Pending',
  'Strategy / Approval Pending', 'Ready to Launch', 'Active – In Delivery', 'Payment Overdue', 'Paused',
  'Suspended', 'Offboarded', 'Archived',
];

/**
 * @param ctx.client     { isActive, deletedAt, offboardedAt, serviceStatus, isTemporaryPassword, agreementVersion, acceptedAgreementVersion, agreementDetails, profile }
 * @param ctx.finance    { received, outstanding } from sent invoices (null = no invoice access / nothing billed)
 * @param ctx.isDefaulter
 * @param ctx.kycStatus  services/kyc.js overall().status
 * @param ctx.onboarding { items, live } (items: the checklist, or the steps that apply when none exists yet)
 * @param ctx.globalAgreementVersion
 * @returns {{ stage, reason }}
 */
function stageOf({ client, finance, isDefaulter, kycStatus, onboarding, globalAgreementVersion = 0 }) {
  if (client.offboardedAt) return { stage: 'Offboarded', reason: 'The engagement has ended.' };
  if (client.deletedAt) return { stage: 'Archived', reason: 'The account is deleted (archived).' };
  if (client.isActive === false) return { stage: 'Suspended', reason: 'Portal login is suspended.' };
  if (client.serviceStatus === 'Hold') return { stage: 'Paused', reason: 'Service is on hold.' };
  if (isDefaulter) return { stage: 'Payment Overdue', reason: 'An invoice is past its due date.' };
  if (client.isTemporaryPassword) return { stage: 'Pending Onboarding', reason: 'The client has not activated the portal yet.' };
  if (!onboarding.live && finance && finance.outstanding > 0 && !(finance.received > 0)) {
    return { stage: 'Awaiting Payment', reason: 'An invoice is issued and nothing has been paid yet.' };
  }
  if (!isAgreementConfigured(client)) return { stage: 'Awaiting Agreement', reason: 'The agreement has not been prepared yet.' };
  if (needsAgreementAcceptance(client, globalAgreementVersion)) return { stage: 'Awaiting Agreement', reason: 'The client has not signed the latest agreement.' };
  if (kycStatus !== 'verified') return { stage: 'KYC Pending', reason: 'KYC is not verified yet.' };
  if (onboarding.live) return { stage: 'Active – In Delivery', reason: 'Campaigns are live.' };

  const open = (onboarding.items || []).filter((i) => i.launchCritical !== false && !DONE.includes(i.status) && !COVERED_ELSEWHERE.has(i.key));
  const setup = open.filter((i) => !APPROVAL_STEPS.has(i.key));
  if (setup.length) return { stage: 'Access / Setup Pending', reason: `${setup.length} setup step${setup.length === 1 ? '' : 's'} open: ${setup.map((i) => i.label).slice(0, 2).join(', ')}${setup.length > 2 ? '…' : ''}` };
  if (open.length) return { stage: 'Strategy / Approval Pending', reason: `Waiting for: ${open.map((i) => i.label).join(', ')}` };
  return { stage: 'Ready to Launch', reason: 'Every launch step is done — the campaign can go live.' };
}

/**
 * Stages for portfolio rows (services/portfolio.js) in one pass.
 * @param rows  [{ _id, client (raw fields above), finance?, isDefaulter }]
 * @returns Map<clientId, { stage, reason }>
 */
async function stagesFor(rows) {
  const ids = rows.map((r) => r._id);
  const [kycDocs, checklists, global] = await Promise.all([
    ClientKyc.find({ client_ref: { $in: ids } }).select('client_ref items').lean(),
    OnboardingChecklist.find({ client_ref: { $in: ids } }).select('client_ref items goLive').lean(),
    Agreement.findOne().sort({ version: -1 }).select('version').lean(),
  ]);
  const kycOf = new Map(kycDocs.map((d) => [String(d.client_ref), d]));
  const listOf = new Map(checklists.map((d) => [String(d.client_ref), d]));
  const blankKyc = { items: Object.fromEntries(kyc.ITEMS.map((i) => [i.key, {}])) };

  const out = new Map();
  for (const r of rows) {
    const k = String(r._id);
    const list = listOf.get(k);
    // No checklist yet: every step that applies to the client's services is still open
    const items = list ? list.items : applicableTemplate({ services: r.client.profile?.services, platforms: r.client.profile?.platforms })
      .map((t) => ({ key: t.key, label: t.label, launchCritical: true, status: 'Not Started' }));
    out.set(k, stageOf({
      client: r.client,
      finance: r.finance || null,
      isDefaulter: r.isDefaulter,
      kycStatus: kyc.overall(kycOf.get(k) || blankKyc).status,
      onboarding: { items, live: !!list?.goLive?.isLive },
      globalAgreementVersion: global?.version || 0,
    }));
  }
  return out;
}

module.exports = { STAGES, stageOf, stagesFor };
