const Settings = require('../models/Settings');
const { PROJECT_BUDGET_OPTIONS, MONTHLY_MARKETING_BUDGET_OPTIONS } = require('../utils/serviceQualification');

/**
 * Configurable Lead Score — a supplementary, admin-tunable signal, NOT the
 * source of truth for Lead Priority (that stays rule-derived from explicit
 * business signals — see utils/serviceQualification.js's derivePriority()).
 * This exists so BDs/managers have a second, at-a-glance number reflecting
 * engagement/fit strength, entirely configurable from Admin Settings
 * (Settings key 'lead_scoring') — no point values or thresholds are
 * hard-coded in the frontend.
 *
 * Same "fetch fresh, no cache, shallow-merge over defaults" convention as
 * services/payrollEngine.js's getPayrollSettings().
 */

const DEFAULT_LEAD_SCORING_SETTINGS = {
  enabled: true,
  points: {
    serviceFit: 15,     // a target Vedhunt service has been identified
    budgetFit: 20,      // budget band at/above the configured threshold
    decisionMaker: 15,  // decision maker confirmed (Yes)
    timeline: 20,       // Immediate / 7 days
    engagement: 10,     // connected on a call
    proposal: 25,       // proposal requested/sent — strong positive
    noResponse: -15,    // repeated unanswered attempts
    junkDuplicate: -100 // hard negative — see the exclude check below
  },
  // Ordinal thresholds into PROJECT_BUDGET_OPTIONS / MONTHLY_MARKETING_BUDGET_OPTIONS
  // (utils/serviceQualification.js) — a lead's band counts as "budget fit"
  // once it's at or past this band on either scale.
  budgetFitThreshold: {
    project: '₹75K–2L',
    marketing: '₹50K–1L'
  },
  // How many logged not-connected call attempts count as "repeated unanswered".
  noResponseAttempts: 3
};

async function getLeadScoringSettings() {
  const doc = await Settings.findOne({ key: 'lead_scoring' });
  const saved = doc?.value || {};
  return {
    ...DEFAULT_LEAD_SCORING_SETTINGS,
    ...saved,
    points: { ...DEFAULT_LEAD_SCORING_SETTINGS.points, ...saved.points },
    budgetFitThreshold: { ...DEFAULT_LEAD_SCORING_SETTINGS.budgetFitThreshold, ...saved.budgetFitThreshold }
  };
}

/** A real selected band, excluding the "Not sure"/unset placeholder. */
function bandIndex(options, value) {
  if (!value || value === 'Not sure') return -1;
  return options.indexOf(value);
}

/**
 * @param {object} lead     plain lead object (existing + incoming merged state)
 * @param {object} settings from getLeadScoringSettings()
 * @returns {number} 0-100
 */
function computeLeadScore(lead, settings) {
  if (!settings.enabled) return 0;

  // Hard negative / exclude — a junk or duplicate-flagged lead scores 0
  // regardless of anything else.
  if (lead.interestLevel === 'Wrong / Junk Lead' || lead.notConvertedReason === 'Duplicate / Junk') {
    return 0;
  }

  const points = settings.points || {};
  let score = 0;

  if ((lead.servicesRequired || []).length > 0) {
    score += points.serviceFit || 0;
  }

  const projectIdx = bandIndex(PROJECT_BUDGET_OPTIONS, lead.projectBudget);
  const projectThresholdIdx = bandIndex(PROJECT_BUDGET_OPTIONS, settings.budgetFitThreshold?.project);
  const marketingIdx = bandIndex(MONTHLY_MARKETING_BUDGET_OPTIONS, lead.monthlyMarketingBudget);
  const marketingThresholdIdx = bandIndex(MONTHLY_MARKETING_BUDGET_OPTIONS, settings.budgetFitThreshold?.marketing);
  const budgetFits =
    (projectIdx !== -1 && projectThresholdIdx !== -1 && projectIdx >= projectThresholdIdx) ||
    (marketingIdx !== -1 && marketingThresholdIdx !== -1 && marketingIdx >= marketingThresholdIdx);
  if (budgetFits) score += points.budgetFit || 0;

  if (lead.decisionMaker === 'Yes') {
    score += points.decisionMaker || 0;
  }

  if (['Immediate', '7 days'].includes(lead.timeline)) {
    score += points.timeline || 0;
  }

  if (lead.connected === 'Yes') {
    score += points.engagement || 0;
  }

  const proposalStages = ['Proposal Sent', 'Negotiation', 'Won'];
  if (lead.proposalSentDate || proposalStages.includes(lead.status)) {
    score += points.proposal || 0;
  }

  const notConnectedCount = (lead.callLogs || []).filter((c) => c.connected === 'No').length;
  if (notConnectedCount >= (settings.noResponseAttempts ?? 3)) {
    score += points.noResponse || 0;
  }

  // Clamped to a stable 0-100 display range regardless of how an admin
  // weights the individual signals.
  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = { DEFAULT_LEAD_SCORING_SETTINGS, getLeadScoringSettings, computeLeadScore };
