import TeamPerformance from '../../components/common/TeamPerformance';
import { essGet, useAccess } from '../lib/ess';

const fetchData = (path, params) => essGet(`/team-performance${path}`, { params });

/** Reporting manager's view of their direct reports' calls and leads (a Super Admin sees every BDE). */
export default function TeamPerformanceTab() {
  const { can } = useAccess();
  return (
    <TeamPerformance
      scope="ess"
      fetchData={fetchData}
      subtitle={can('team.performance') ? 'Every BDE' : 'Your direct reports'}
    />
  );
}
