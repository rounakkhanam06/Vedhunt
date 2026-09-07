/**
 * Service-aware Lead Qualification vocabulary — mirrors the split already
 * used for leadStateMachine.js/leadConstants.js: this is the backend source
 * of truth, client/src/shared/serviceQualification.js is the UI-rendering
 * copy. The service list itself matches the public quote form's
 * `servicesOptions` (client/src/pages/GetQuote.jsx) — that's the fullest,
 * most already-in-use taxonomy in the codebase.
 */

const SERVICES_REQUIRED_OPTIONS = [
  'Website Development',
  'App Development',
  'Digital Marketing',
  'Performance Marketing',
  'MIS & Reporting',
  'Accounting & Finance',
  'Logo & Graphic Design',
  'Shipping Management',
  'Workflow Management'
];

// Which services use a recurring "Monthly Marketing Budget" instead of a
// one-off "Project Budget" — drives which budget field(s) the Qualification
// UI shows for a given lead's servicesRequired.
const MARKETING_TYPE_SERVICES = ['Digital Marketing', 'Performance Marketing'];

const TIMELINE_OPTIONS = ['Immediate', '7 days', '30 days', '60+ days', 'Not decided'];

const DECISION_MAKER_OPTIONS = ['Yes', 'No', 'Unknown'];

// Two canonical band scales (not one per service) so pipeline value is
// comparable across leads for reporting — GetQuote's raw per-service bands
// get mapped onto these at intake (see GetQuote.jsx), a BD can always correct it.
const PROJECT_BUDGET_OPTIONS = ['Below ₹25K', '₹25K–75K', '₹75K–2L', '₹2L–5L', '₹5L–15L', 'Above ₹15L', 'Not sure'];
const MONTHLY_MARKETING_BUDGET_OPTIONS = ['Below ₹50K', '₹50K–1L', '₹1L–3L', '₹3L–5L', 'Above ₹5L', 'Not sure'];

const LEAD_PRIORITY_LEVELS = ['Hot', 'Warm', 'Normal', 'Low'];

// Top two bands of each budget scale — used by the "high budget" signal below.
const HIGH_PROJECT_BUDGET_BANDS = ['₹5L–15L', 'Above ₹15L'];
const HIGH_MARKETING_BUDGET_BANDS = ['₹3L–5L', 'Above ₹5L'];

/**
 * Auto-derives Lead Priority from the three strongest qualification signals.
 * Read-only/server-only — never client-settable (see leadStateMachine.js's
 * LEAD_UPDATE_FIELDS), recomputed by leadLifecycle.js on every qualification
 * save, same treatment as leadAgeAtCall.
 */
function derivePriority({ decisionMaker, timeline, projectBudget, monthlyMarketingBudget }) {
  const hasBudget =
    (!!projectBudget && projectBudget !== 'Not sure') ||
    (!!monthlyMarketingBudget && monthlyMarketingBudget !== 'Not sure');
  const hasHighBudget =
    HIGH_PROJECT_BUDGET_BANDS.includes(projectBudget) ||
    HIGH_MARKETING_BUDGET_BANDS.includes(monthlyMarketingBudget);
  const fastTimeline = ['Immediate', '7 days'].includes(timeline);
  const midTimeline = ['Immediate', '7 days', '30 days'].includes(timeline);

  if (decisionMaker === 'Yes' && fastTimeline && hasBudget) return 'Hot';
  if ((decisionMaker === 'Yes' || decisionMaker === 'Unknown') && (midTimeline || hasHighBudget)) return 'Warm';
  // Low must be checked before the Normal catch-all below — it's a more
  // specific match that the catch-all's "!hasBudget && (decisionMaker or
  // timeline)" clause would otherwise always intercept first.
  if (timeline === 'Not decided' && !hasBudget && decisionMaker === 'No') return 'Low';
  if (timeline === '60+ days' || (!hasBudget && (decisionMaker || timeline))) return 'Normal';
  return 'Normal';
}

module.exports = {
  SERVICES_REQUIRED_OPTIONS,
  MARKETING_TYPE_SERVICES,
  TIMELINE_OPTIONS,
  DECISION_MAKER_OPTIONS,
  PROJECT_BUDGET_OPTIONS,
  MONTHLY_MARKETING_BUDGET_OPTIONS,
  LEAD_PRIORITY_LEVELS,
  derivePriority
};
