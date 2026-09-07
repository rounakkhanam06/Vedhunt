/**
 * Service-aware Lead Qualification vocabulary — mirrors
 * server/utils/serviceQualification.js. UI-rendering copy only; Lead
 * Priority is derived server-side (see leadLifecycle.js), not here.
 */

export const SERVICES_REQUIRED_OPTIONS = [
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
export const MARKETING_TYPE_SERVICES = ['Digital Marketing', 'Performance Marketing'];

export const TIMELINE_OPTIONS = ['Immediate', '7 days', '30 days', '60+ days', 'Not decided'];

export const DECISION_MAKER_OPTIONS = ['Yes', 'No', 'Unknown'];

export const PROJECT_BUDGET_OPTIONS = ['Below ₹25K', '₹25K–75K', '₹75K–2L', '₹2L–5L', '₹5L–15L', 'Above ₹15L', 'Not sure'];
export const MONTHLY_MARKETING_BUDGET_OPTIONS = ['Below ₹50K', '₹50K–1L', '₹1L–3L', '₹3L–5L', 'Above ₹5L', 'Not sure'];

export const LEAD_PRIORITY_LEVELS = ['Hot', 'Warm', 'Normal', 'Low'];

export const LEAD_PRIORITY_BADGE_CLASSES = {
  Hot: 'bg-red-500/10 text-red-400 border-red-500/20',
  Warm: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Normal: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Low: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};
