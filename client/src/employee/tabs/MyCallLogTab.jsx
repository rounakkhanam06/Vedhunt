import { MyCallLog } from '../../components/common/TeamPerformance';
import { essGet } from '../lib/ess';

const fetchData = (path, params) => essGet(`/my-calls${path}`, { params });
const leadHref = (leadRef) => `/employee/leads/${leadRef}`;

/** A BDE's own call history — every call they logged, by period, searchable. */
export default function MyCallLogTab() {
  return <MyCallLog scope="ess" fetchData={fetchData} leadHref={leadHref} />;
}
