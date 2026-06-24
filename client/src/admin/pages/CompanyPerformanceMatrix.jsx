import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { BarChart2, RefreshCw, Star, Trophy, ChevronDown, ChevronUp, Download, X } from 'lucide-react';

const BAND_CONFIG = {
  'Outstanding':           { color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',  dot: 'bg-yellow-400' },
  'Exceeds Expectations':  { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  'Meets Expectations':    { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',          dot: 'bg-blue-400' },
  'Needs Improvement':     { color: 'bg-orange-500/15 text-orange-400 border-orange-500/30',   dot: 'bg-orange-400' },
  'Poor':                  { color: 'bg-rose-500/15 text-rose-400 border-rose-500/30',          dot: 'bg-rose-400' },
  'Pending':               { color: 'bg-white/5 text-gray-500 border-white/10',                 dot: 'bg-gray-600' },
};

const StatusBadge = ({ status }) => {
  const s = {
    Pending:         'bg-white/5 text-gray-500',
    SelfSubmitted:   'bg-blue-500/10 text-blue-400',
    ManagerReviewed: 'bg-emerald-500/10 text-emerald-400',
    Finalized:       'bg-orange-500/10 text-orange-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${s[status] || s.Pending}`}>
      {status}
    </span>
  );
};

const StarRating = ({ value }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={12} className={i <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />
    ))}
  </div>
);

const CompanyPerformanceMatrix = () => {
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [matrix, setMatrix] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [reviewModal, setReviewModal] = useState(null); // { reviewId, empName }
  const [reviewForm, setReviewForm] = useState({ managerRating: 0, managerFeedback: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [filterBand, setFilterBand] = useState('All');
  const [filterDept, setFilterDept] = useState('All');

  useEffect(() => {
    api.get('/performance/cycles').then(res => {
      if (res.data.success) {
        setCycles(res.data.cycles);
        const active = res.data.cycles.find(c => c.status === 'Active');
        if (active) { setSelectedCycle(active._id); }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedCycle) fetchMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCycle]);

  const fetchMatrix = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/performance/company-matrix/${selectedCycle}`);
      if (res.data.success) setMatrix(res.data.matrix);
    } catch {
      toast.error('Failed to load performance matrix.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncActuals = async () => {
    if (!window.confirm('This will auto-pull actual performance data from CRM, WorkLog and Attendance for all employees. Continue?')) return;
    setIsSyncing(true);
    try {
      const res = await api.post(`/performance/sync-actual/${selectedCycle}`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchMatrix();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmitManagerReview = async () => {
    if (reviewForm.managerRating < 1) { toast.error('Please select a rating.'); return; }
    if (!reviewForm.managerFeedback.trim()) { toast.error('Feedback is required.'); return; }
    setIsSubmittingReview(true);
    try {
      const res = await api.post(`/performance/review/manager/${reviewModal.reviewId}`, reviewForm);
      if (res.data.success) {
        toast.success('Manager review submitted!');
        setReviewModal(null);
        setReviewForm({ managerRating: 0, managerFeedback: '' });
        fetchMatrix();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Rank', 'Employee', 'Dept', 'Final Score', 'Band', 'Top Performer', 'Status', 'Self Rating', 'Manager Rating'];
    const rows = filtered.map(({ review }) => [
      review.companyRank || '-',
      `${review.employeeId?.firstName} ${review.employeeId?.lastName}`,
      review.employeeId?.roleDept,
      review.finalScore,
      review.performanceBand,
      review.isTopPerformer ? 'Yes' : 'No',
      review.status,
      review.selfReview?.selfRating || '-',
      review.managerReview?.managerRating || '-'
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `performance_matrix_${selectedCycle}.csv`;
    a.click();
  };

  // Filtering
  const depts = ['All', ...new Set(matrix.map(m => m.review.employeeId?.roleDept).filter(Boolean))];
  const bands = ['All', 'Outstanding', 'Exceeds Expectations', 'Meets Expectations', 'Needs Improvement', 'Poor', 'Pending'];
  const filtered = matrix.filter(m => {
    const bandMatch = filterBand === 'All' || m.review.performanceBand === filterBand;
    const deptMatch = filterDept === 'All' || m.review.employeeId?.roleDept === filterDept;
    return bandMatch && deptMatch;
  });

  const selectedCycleObj = cycles.find(c => c._id === selectedCycle);

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <BarChart2 className="text-orange-500" size={28} />
            Company Performance Matrix
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {selectedCycleObj ? selectedCycleObj.title : 'Select a cycle to view rankings.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncActuals}
            disabled={!selectedCycle || isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 font-medium transition-all cursor-pointer disabled:opacity-40 text-sm"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync Actuals'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!matrix.length}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-medium transition-all cursor-pointer disabled:opacity-40 text-sm"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Cycle Selector + Filters */}
      <div className="flex flex-wrap gap-3 bg-[#141416] p-4 rounded-xl border border-white/5">
        <select
          value={selectedCycle}
          onChange={e => setSelectedCycle(e.target.value)}
          className="text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white focus:outline-none"
        >
          <option value="">Select Cycle...</option>
          {cycles.map(c => <option key={c._id} value={c._id}>{c.title} [{c.status}]</option>)}
        </select>
        <select
          value={filterBand}
          onChange={e => setFilterBand(e.target.value)}
          className="text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white focus:outline-none"
        >
          {bands.map(b => <option key={b}>{b}</option>)}
        </select>
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2 text-white focus:outline-none"
        >
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* Summary Cards */}
      {matrix.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Outstanding', 'Exceeds Expectations', 'Meets Expectations', 'Needs Improvement'].map(band => {
            const count = matrix.filter(m => m.review.performanceBand === band).length;
            const cfg = BAND_CONFIG[band];
            return (
              <div key={band} className="bg-[#141416] rounded-xl border border-white/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <div className="text-xs text-gray-400">{band}</div>
                </div>
                <div className="text-3xl font-black text-white">{count}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Matrix Table */}
      <div className="bg-[#141416] rounded-2xl border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
          </div>
        ) : !selectedCycle ? (
          <div className="text-center py-16 text-gray-600">Select a cycle to view the matrix.</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600">
            {matrix.length === 0 ? 'No employees have KPI targets assigned for this cycle yet.' : 'No results match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-xs text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-5 w-14">Rank</th>
                  <th className="py-4 px-5">Employee</th>
                  <th className="py-4 px-5">Score</th>
                  <th className="py-4 px-5">Band</th>
                  <th className="py-4 px-5">Self Review</th>
                  <th className="py-4 px-5">Mgr Review</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-sm">
                {filtered.map(({ review, targets }) => {
                  const emp = review.employeeId;
                  const cfg = BAND_CONFIG[review.performanceBand] || BAND_CONFIG['Pending'];
                  const isExpanded = expandedRow === review._id;

                  return (
                    <>
                      <tr key={review._id} className="hover:bg-white/[0.015] transition-colors">
                        {/* Rank */}
                        <td className="py-4 px-5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                            review.companyRank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                            review.companyRank === 2 ? 'bg-gray-400/20 text-gray-300' :
                            review.companyRank === 3 ? 'bg-amber-700/20 text-amber-600' :
                            'bg-white/5 text-gray-500'
                          }`}>
                            {review.companyRank || '—'}
                          </div>
                        </td>

                        {/* Employee */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-600/10 text-orange-500 flex items-center justify-center text-xs font-bold border border-orange-500/15 flex-shrink-0">
                              {emp?.firstName?.charAt(0)}{emp?.lastName?.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-2">
                                {emp?.firstName} {emp?.lastName}
                                {review.isTopPerformer && <Trophy size={14} className="text-yellow-400" />}
                              </div>
                              <div className="text-xs text-gray-500">{emp?.roleDept}</div>
                            </div>
                          </div>
                        </td>

                        {/* Score */}
                        <td className="py-4 px-5">
                          <div className={`text-2xl font-black ${review.finalScore >= 100 ? 'text-yellow-400' : review.finalScore >= 75 ? 'text-emerald-400' : review.finalScore >= 60 ? 'text-blue-400' : 'text-orange-400'}`}>
                            {review.finalScore > 0 ? review.finalScore.toFixed(1) : '—'}
                          </div>
                          {review.finalScore > 0 && <div className="text-[10px] text-gray-600">weighted score</div>}
                        </td>

                        {/* Band */}
                        <td className="py-4 px-5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.color}`}>
                            {review.performanceBand}
                          </span>
                        </td>

                        {/* Self Review */}
                        <td className="py-4 px-5">
                          {review.selfReview?.isSubmitted ? (
                            <div>
                              <StarRating value={review.selfReview.selfRating} />
                              <div className="text-[10px] text-gray-500 mt-1">Submitted</div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-600 uppercase tracking-wider">Pending</span>
                          )}
                        </td>

                        {/* Manager Review */}
                        <td className="py-4 px-5">
                          {review.managerReview?.isSubmitted ? (
                            <div>
                              <StarRating value={review.managerReview.managerRating} />
                              <div className="text-[10px] text-gray-500 mt-1">
                                By: {review.managerReview.reviewedBy?.firstName || 'Manager'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-600 uppercase tracking-wider">Pending</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-5">
                          <StatusBadge status={review.status} />
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          <div className="flex gap-2 justify-end">
                            {!review.managerReview?.isSubmitted && (
                              <button
                                onClick={() => setReviewModal({ reviewId: review._id, empName: `${emp?.firstName} ${emp?.lastName}` })}
                                className="px-3 py-1.5 rounded-lg bg-orange-600/10 text-orange-400 hover:bg-orange-600 hover:text-white border border-orange-500/20 text-xs font-bold transition-all cursor-pointer"
                              >
                                Review
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : review._id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded KPI Detail Row */}
                      {isExpanded && (
                        <tr key={`${review._id}-detail`} className="bg-white/[0.01]">
                          <td colSpan="8" className="px-5 pb-4 pt-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {targets.map(t => (
                                <div key={t._id} className="bg-[#1a1a1d] rounded-xl p-3 border border-white/5">
                                  <div className="text-xs text-gray-500 mb-1">{t.metricType}</div>
                                  <div className="flex justify-between items-end">
                                    <div>
                                      <div className="text-xs text-gray-400">Target: <span className="text-white font-bold">{t.targetValue.toLocaleString()} {t.unit}</span></div>
                                      <div className="text-xs text-gray-400">Actual: <span className={`font-bold ${t.actualValue >= t.targetValue ? 'text-emerald-400' : 'text-orange-400'}`}>{t.actualValue.toLocaleString()} {t.unit}</span></div>
                                    </div>
                                    <div className="text-right">
                                      <div className={`text-xl font-black ${t.achievementPct >= 100 ? 'text-emerald-400' : t.achievementPct >= 60 ? 'text-orange-400' : 'text-rose-400'}`}>
                                        {t.achievementPct}%
                                      </div>
                                      <div className="text-[10px] text-gray-600">wt: {t.weightage}%</div>
                                    </div>
                                  </div>
                                  <div className="mt-2 w-full bg-white/10 rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full ${t.achievementPct >= 100 ? 'bg-emerald-500' : t.achievementPct >= 60 ? 'bg-orange-500' : 'bg-rose-500'}`}
                                      style={{ width: `${Math.min(t.achievementPct, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            {review.selfReview?.isSubmitted && (
                              <div className="mt-3 bg-[#1a1a1d] rounded-xl p-4 border border-white/5 text-xs space-y-2">
                                <div className="font-bold text-gray-400 uppercase tracking-wider">Self Review</div>
                                <div className="grid grid-cols-2 gap-3 text-gray-300">
                                  {review.selfReview.achievements && <div><span className="text-gray-600">Achievements: </span>{review.selfReview.achievements}</div>}
                                  {review.selfReview.challenges && <div><span className="text-gray-600">Challenges: </span>{review.selfReview.challenges}</div>}
                                  {review.selfReview.learning && <div><span className="text-gray-600">Learning: </span>{review.selfReview.learning}</div>}
                                  {review.selfReview.supportNeeded && <div><span className="text-gray-600">Support Needed: </span>{review.selfReview.supportNeeded}</div>}
                                </div>
                              </div>
                            )}
                            {review.managerReview?.isSubmitted && (
                              <div className="mt-3 bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/10 text-xs">
                                <div className="font-bold text-emerald-400 uppercase tracking-wider mb-2">Manager Review</div>
                                <div className="text-gray-300">{review.managerReview.managerFeedback}</div>
                                <div className="text-gray-500 mt-1">Reviewed by: {review.managerReview.reviewedBy?.firstName} {review.managerReview.reviewedBy?.lastName} · {new Date(review.managerReview.reviewDate).toLocaleDateString()}</div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manager Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#141416] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-white/5">
              <div>
                <h2 className="text-lg font-bold">Manager Review</h2>
                <p className="text-xs text-gray-400 mt-0.5">{reviewModal.empName}</p>
              </div>
              <button onClick={() => setReviewModal(null)} className="text-gray-400 hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-3">Overall Rating <span className="text-orange-500">*</span></label>
                <div className="flex gap-3">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setReviewForm(f => ({ ...f, managerRating: n }))}
                      className="cursor-pointer transition-transform hover:scale-110"
                    >
                      <Star
                        size={28}
                        className={n <= reviewForm.managerRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600 hover:text-gray-400'}
                      />
                    </button>
                  ))}
                  {reviewForm.managerRating > 0 && (
                    <span className="text-sm text-gray-400 self-center ml-2">
                      {['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'][reviewForm.managerRating]}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Feedback & Comments <span className="text-orange-500">*</span></label>
                <textarea
                  rows={4}
                  placeholder="Provide constructive feedback on performance, achievements, and areas of improvement..."
                  value={reviewForm.managerFeedback}
                  onChange={e => setReviewForm(f => ({ ...f, managerFeedback: e.target.value }))}
                  className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                />
              </div>
              <div className="text-xs text-gray-600 bg-white/[0.02] rounded-lg p-3 border border-white/5">
                This review will be stored with your name and today&apos;s date as the reviewer.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setReviewModal(null)}
                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitManagerReview}
                  disabled={isSubmittingReview}
                  className="flex-1 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold transition-all cursor-pointer text-sm disabled:opacity-60"
                >
                  {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyPerformanceMatrix;
