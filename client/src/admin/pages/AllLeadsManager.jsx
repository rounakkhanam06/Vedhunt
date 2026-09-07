import LeadsManager from './LeadsManager';

// Unscoped view across every stage/status — the Management Dashboard's
// drill-down destination (every KPI links here with query params). Super
// Admin only (see routes/index.jsx), since it's the one place company-wide
// leads are browsable regardless of assignment.
export default function AllLeadsManager() {
  return <LeadsManager />;
}
