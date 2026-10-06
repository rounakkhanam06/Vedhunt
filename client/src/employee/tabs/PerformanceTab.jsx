import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Star, Target, TrendingUp, Trophy, Gauge } from 'lucide-react';
import toast from 'react-hot-toast';
import employeeApi from '../../services/employeeApi';
import { essGet, essKeys, apiError, useAccess } from '../lib/ess';
import { fmtINR } from '../lib/datetime';

const StarRating = ({ value, size = 12 }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= value ? 'text-yellow-400 fill-yellow-400' : 'text-app-text-muted'} />)}
  </div>
);

const PERIODS = [['month', 'This month'], ['quarter', 'This quarter'], ['year', 'This year']];
const formatMetric = ({ value, format }) => {
  if (value === null || value === undefined) return '—';
  if (format === 'pct') return `${value}%`;
  if (format === 'currency') return fmtINR(value);
  if (format === 'hours') return `${value}h`;
  return Number(value).toLocaleString('en-IN');
};
const SEGMENT_TITLE = { BD: 'Business Development', Marketing: 'Digital / Performance Marketing', Technology: 'Project & Technology', Operations: 'MIS / Finance / Operations', Management: 'Management' };

/** Live KPIs for the employee's role/segment — BD sees pipeline KPIs, others delivery & time KPIs. */
function RoleScorecard() {
  const { segment } = useAccess();
  const [period, setPeriod] = useState('month');
  const { data, isLoading } = useQuery({ queryKey: essKeys.kpis(period), queryFn: () => essGet('/performance/kpis', { params: { period } }) });
  return (
    <div className="bg-app-card p-6 rounded-xl border border-app-border space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold flex items-center gap-2"><Gauge className="text-primary" size={20} /> {SEGMENT_TITLE[segment] || 'My'} KPIs</h3>
        <div className="flex bg-form-input-bg border border-app-border p-1 rounded-lg">
          {PERIODS.map(([value, text]) => (
            <button key={value} type="button" onClick={() => setPeriod(value)}
              className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${period === value ? 'bg-primary text-white' : 'text-app-text-muted hover:text-app-text'}`}>{text}</button>
          ))}
        </div>
      </div>
      {isLoading ? <p className="text-sm text-app-text-muted">Calculating…</p> : (data?.groups || []).map((group) => (
        <div key={group.title}>
          <div className="text-xs font-bold uppercase tracking-wider text-app-text-muted mb-2">{group.title}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {group.items.map((item) => (
              <div key={item.key} className="bg-form-input-bg border border-app-border rounded-xl p-3">
                <div className="text-xl font-extrabold text-app-text">{formatMetric(item)}</div>
                <div className="text-xs text-app-text-muted">{item.label}</div>
                {item.hint && <div className="text-[10px] text-app-text-muted/80 mt-0.5">{item.hint}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {segment === 'Marketing' && (
        <p className="text-[11px] text-app-text-muted">Campaign KPIs (spend, ROAS, CPA, CTR) are recorded by your manager against your cycle targets below.</p>
      )}
    </div>
  );
}

const field = 'w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-primary';
const REVIEW_FIELDS = [['achievements', 'Key Achievements'], ['challenges', 'Challenges Faced'], ['learning', 'What did you learn?'], ['supportNeeded', 'Support Needed from Manager']];

export default function PerformanceTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: essKeys.performance,
    queryFn: async () => {
      const [{ data: active }, { data: hist }] = await Promise.all([employeeApi.get('/performance/active-cycle'), employeeApi.get('/performance/history/me')]);
      const cycle = active.cycle || null;
      const scorecard = cycle ? (await employeeApi.get(`/performance/scorecard/me/${cycle._id}`)).data : null;
      return { cycle, review: scorecard?.review || null, targets: scorecard?.targets || [], metricDefs: scorecard?.metricDefs || {}, history: hist.history || [] };
    },
  });
  const [form, setForm] = useState({ achievements: '', challenges: '', learning: '', supportNeeded: '', selfRating: 0 });
  const [submitting, setSubmitting] = useState(false);
  const { cycle: activeCycle, review: scorecard, targets: kpiTargets = [], metricDefs = {}, history = [] } = data || {};

  const submitSelfReview = async (e) => {
    e.preventDefault();
    if (form.selfRating < 1) { toast.error('Please select a rating (1-5 stars)'); return; }
    setSubmitting(true);
    try {
      await employeeApi.post('/performance/review/self', { cycleId: activeCycle._id, ...form });
      toast.success('Self-review submitted successfully!');
      queryClient.invalidateQueries({ queryKey: essKeys.performance });
    } catch (err) {
      toast.error(apiError(err, 'Failed to submit review'));
    } finally {
      setSubmitting(false);
    }
  };

  const scoreTone = (s) => (s >= 100 ? 'text-yellow-400' : s >= 75 ? 'text-emerald-400' : s >= 60 ? 'text-blue-400' : 'text-primary');

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2"><Trophy className="text-primary" /> My Performance Scorecard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-app-card p-6 rounded-xl border border-app-border relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <h3 className="text-app-text-muted text-sm font-bold uppercase tracking-wider mb-1">Current Cycle</h3>
          <div className="text-xl md:text-2xl font-extrabold text-app-text mb-4 leading-tight">{isLoading ? '…' : activeCycle ? activeCycle.title : 'No Active Cycle'}</div>
          {activeCycle ? (
            <div className="flex flex-wrap gap-4 md:gap-6 text-sm">
              <div><div className="text-app-text-muted text-xs uppercase tracking-wider mb-0.5">Start Date</div><div className="font-bold text-app-text">{new Date(activeCycle.startDate).toLocaleDateString()}</div></div>
              <div><div className="text-app-text-muted text-xs uppercase tracking-wider mb-0.5">End Date</div><div className="font-bold text-app-text">{new Date(activeCycle.endDate).toLocaleDateString()}</div></div>
              <div><div className="text-app-text-muted text-xs uppercase tracking-wider mb-0.5">Status</div><div className="font-bold text-emerald-400">Active</div></div>
            </div>
          ) : !isLoading && <div className="text-sm text-app-text-muted">Wait for your manager to activate a new review cycle.</div>}
        </div>

        {scorecard && (
          <div className="bg-app-card p-6 rounded-xl border border-app-border flex flex-col justify-center items-center text-center relative overflow-hidden">
            {scorecard.isTopPerformer && <div className="absolute top-3 right-3 text-yellow-400 animate-pulse" title="Top Performer!"><Trophy size={20} /></div>}
            <h3 className="text-app-text-muted text-xs font-bold uppercase tracking-wider mb-2">Final Weighted Score</h3>
            <div className={`text-5xl font-black mb-2 ${scoreTone(scorecard.finalScore)}`}>{scorecard.finalScore.toFixed(1)}</div>
            <div className="px-3 py-1 rounded-full text-xs font-bold border bg-app-border/20 border-app-border text-app-text">{scorecard.performanceBand}</div>
            {scorecard.companyRank && <div className="mt-3 text-xs text-app-text-muted">Company Rank: <span className="font-bold text-app-text">#{scorecard.companyRank}</span></div>}
          </div>
        )}
      </div>

      <RoleScorecard />

      {kpiTargets.length > 0 && (
        <div className="bg-app-card p-6 rounded-xl border border-app-border">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Target className="text-primary" size={20} /> KPI Targets & Progress</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpiTargets.map((t) => (
              <div key={t._id} className="bg-white/[0.02] border border-app-border rounded-xl p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-sm font-bold text-app-text">{metricDefs[t.metricType]?.label || t.metricType}</div>
                  <div className="text-xs text-app-text-muted px-2 py-0.5 bg-app-border/20 rounded font-bold">wt: {t.weightage}%</div>
                </div>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <div className="text-xs text-app-text-muted">Target: <span className="text-app-text font-bold">{t.targetValue.toLocaleString()} {t.unit}</span></div>
                    <div className="text-xs text-app-text-muted">Actual: <span className={`font-bold ${t.actualValue >= t.targetValue ? 'text-emerald-400' : 'text-primary'}`}>{t.actualValue.toLocaleString()} {t.unit}</span></div>
                  </div>
                  <div className={`text-2xl font-black ${t.achievementPct >= 100 ? 'text-emerald-400' : t.achievementPct >= 60 ? 'text-primary' : 'text-rose-400'}`}>{t.achievementPct}%</div>
                </div>
                <div className="w-full bg-app-border/30 rounded-full h-1.5 mt-2">
                  <div className={`h-1.5 rounded-full ${t.achievementPct >= 100 ? 'bg-emerald-500' : t.achievementPct >= 60 ? 'bg-primary' : 'bg-rose-500'}`} style={{ width: `${Math.min(t.achievementPct, 100)}%` }} />
                </div>
                <div className="text-[10px] text-app-text-muted mt-2 text-right">Last updated: {t.lastSyncedAt ? new Date(t.lastSyncedAt).toLocaleString() : 'Never'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeCycle && scorecard && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-app-card p-6 rounded-xl border border-app-border">
            <h3 className="text-lg font-bold mb-4 text-app-text">Self Review</h3>
            {scorecard.selfReview?.isSubmitted ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-app-text-muted">Your Rating:</span>
                  <StarRating value={scorecard.selfReview.selfRating} size={16} />
                  <span className="ml-2 px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded uppercase font-bold tracking-wider">Submitted</span>
                </div>
                <div className="space-y-3 text-sm">
                  {REVIEW_FIELDS.map(([key, text]) => scorecard.selfReview[key] && (
                    <div key={key}><span className="text-app-text-muted block text-xs uppercase mb-0.5">{text}</span><div className="text-app-text bg-white/[0.02] p-3 rounded-lg">{scorecard.selfReview[key]}</div></div>
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={submitSelfReview} className="space-y-4">
                <div className="text-sm text-app-text-muted mb-4 bg-primary/5 border border-primary/10 p-3 rounded-lg">Submit your self-review for the current cycle. Once submitted, it cannot be edited.</div>
                <div>
                  <label className="block text-xs text-app-text-muted mb-1.5">Your Self Rating (1-5 Stars) <span className="text-primary">*</span></label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button type="button" key={n} onClick={() => setForm((f) => ({ ...f, selfRating: n }))} className="cursor-pointer transition-transform hover:scale-110">
                        <Star size={24} className={n <= form.selfRating ? 'text-yellow-400 fill-yellow-400' : 'text-app-text-muted'} />
                      </button>
                    ))}
                  </div>
                </div>
                {REVIEW_FIELDS.map(([key, text]) => (
                  <div key={key}>
                    <label className="block text-xs text-app-text-muted mb-1.5">{text}</label>
                    <textarea rows={2} className={field} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <button type="submit" disabled={submitting || form.selfRating < 1} className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold transition-all cursor-pointer disabled:opacity-50 mt-2">
                  {submitting ? 'Submitting...' : 'Submit Self Review'}
                </button>
              </form>
            )}
          </div>

          <div className="bg-app-card p-6 rounded-xl border border-app-border flex flex-col">
            <h3 className="text-lg font-bold mb-4 text-app-text">Manager Review</h3>
            {scorecard.managerReview?.isSubmitted ? (
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-app-text-muted">Manager Rating:</span>
                  <StarRating value={scorecard.managerReview.managerRating} size={16} />
                  <span className="ml-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded uppercase font-bold tracking-wider">Reviewed</span>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl text-sm text-app-text flex-1">
                  <div className="font-bold text-emerald-400 text-xs uppercase mb-2">Feedback & Comments</div>
                  {scorecard.managerReview.managerFeedback}
                </div>
                <div className="text-xs text-app-text-muted flex items-center justify-between border-t border-app-border pt-4 mt-4">
                  <span>Reviewed by: <span className="text-app-text font-bold">{scorecard.managerReview.reviewedBy?.firstName} {scorecard.managerReview.reviewedBy?.lastName}</span></span>
                  <span>{new Date(scorecard.managerReview.reviewDate).toLocaleDateString()}</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-app-text-muted space-y-3 py-10">
                <div className="w-12 h-12 rounded-full bg-app-border/20 flex items-center justify-center"><Clock size={20} className="text-app-text-muted" /></div>
                <p className="text-sm">Manager review is pending.</p>
                <p className="text-xs text-app-text-muted">Your manager will provide feedback and a final rating after the cycle ends.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-app-card p-6 rounded-xl border border-app-border">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><TrendingUp className="text-primary" size={20} /> Past Performance History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                  <th className="py-3 px-4">Cycle</th><th className="py-3 px-4">Final Score</th><th className="py-3 px-4">Band</th>
                  <th className="py-3 px-4">Self Rating</th><th className="py-3 px-4">Mgr Rating</th><th className="py-3 px-4">Top Performer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {history.map((hist) => (
                  <tr key={hist._id} className="hover:bg-white/[0.01]">
                    <td className="py-4 px-4 font-bold text-app-text">{hist.cycleId?.title || 'Unknown Cycle'}</td>
                    <td className="py-4 px-4 font-black text-app-text">{hist.finalScore}</td>
                    <td className="py-4 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-app-border/20 border-app-border text-app-text">{hist.performanceBand}</span></td>
                    <td className="py-4 px-4"><StarRating value={hist.selfReview?.selfRating || 0} /></td>
                    <td className="py-4 px-4"><StarRating value={hist.managerReview?.managerRating || 0} /></td>
                    <td className="py-4 px-4">{hist.isTopPerformer && <Trophy size={16} className="text-yellow-400" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
