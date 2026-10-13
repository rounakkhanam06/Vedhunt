import TeamPerformance from '../../components/common/TeamPerformance';
import api from '../../services/api';

const fetchData = (path, params) => api.get(`/admin/activity/team-performance${path}`, { params }).then((r) => r.data);
const leadHref = (leadRef) => `/admin/leads/${leadRef}`;

/** Super Admin: every BDE's calls, leads and follow-ups (managers use the Employee Portal tab). */
export default function TeamPerformancePage() {
  return <TeamPerformance scope="admin" fetchData={fetchData} leadHref={leadHref} title="BDE Team Performance" subtitle="Every BDE" />;
}
