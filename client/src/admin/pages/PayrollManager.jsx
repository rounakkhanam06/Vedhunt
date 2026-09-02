import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Settings as SettingsIcon, PlayCircle, ChevronDown, ChevronUp, X, Send, PauseCircle,
  CheckCircle2, Download, IndianRupee
} from 'lucide-react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATUSES = ['Draft', 'UnderReview', 'OnHold', 'Approved', 'Generated', 'Sent'];

const STATUS_CLASS = {
  Draft: 'bg-surface-variant text-app-text-muted border-app-border',
  UnderReview: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  OnHold: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Approved: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Generated: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  Sent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
};

const inr = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

const fieldLabelClass = 'block text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-1';
const inputClass = 'w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text focus:outline-none focus:ring-1 focus:ring-primary';

export default function PayrollManager() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() === 0 ? 12 : now.getMonth()); // previous month, 1-12
  const [year, setYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const [statusFilter, setStatusFilter] = useState('All');
  const [employeeFilter, setEmployeeFilter] = useState('All');

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [busyRunId, setBusyRunId] = useState(null);
  const [drafts, setDrafts] = useState({}); // runId -> editable fields

  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/payroll/runs', { params: { month, year, status: statusFilter, employeeId: employeeFilter } });
      if (res.data.success) setRuns(res.data.runs);
    } catch {
      toast.error('Failed to load payroll runs');
    } finally {
      setLoading(false);
    }
  }, [month, year, statusFilter, employeeFilter]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  useEffect(() => {
    api.get('/payroll/settings').then((res) => { if (res.data.success) setSettings(res.data.settings); }).catch(() => {});
  }, []);

  const employeeOptions = useMemo(() => {
    const map = new Map();
    runs.forEach((r) => { if (r.employeeId?._id) map.set(r.employeeId._id, r.employeeId); });
    return [...map.values()];
  }, [runs]);

  const totals = useMemo(() => ({
    gross: runs.reduce((s, r) => s + (r.grossEarnings || 0), 0),
    deductions: runs.reduce((s, r) => s + (r.totalDeductions || 0), 0),
    net: runs.reduce((s, r) => s + (r.netPay || 0), 0)
  }), [runs]);

  const getDraft = (run) => drafts[run._id] || {
    bonus: run.earnings.bonus || 0,
    incentive: run.earnings.incentive || 0,
    reimbursement: run.earnings.reimbursement || 0,
    arrears: run.earnings.arrears || 0,
    tds: run.deductions.tds || 0,
    otherDeductions: run.deductions.otherDeductions || 0,
    otherDeductionsReason: run.deductions.otherDeductionsReason || '',
    remarks: run.remarks || ''
  };
  const updateDraft = (runId, field, value) => setDrafts((prev) => ({ ...prev, [runId]: { ...(prev[runId] || getDraft(runs.find(r => r._id === runId))), [field]: value } }));

  const handleGeneratePayroll = async () => {
    setIsGenerating(true);
    try {
      const res = await api.post('/payroll/runs/generate', { month, year });
      if (res.data.success) {
        toast.success('Payroll calculated for all employees.');
        fetchRuns();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate payroll.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async (run) => {
    const draft = getDraft(run);
    setBusyRunId(run._id);
    try {
      const res = await api.put(`/payroll/runs/${run._id}`, draft);
      if (res.data.success) {
        toast.success('Saved');
        fetchRuns();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save.');
    } finally {
      setBusyRunId(null);
    }
  };

  const handleApprove = async (run) => {
    if (!window.confirm(`Approve and send ${run.employeeId?.firstName}'s payslip for ${MONTH_NAMES[run.month - 1]} ${run.year}? Net pay: ${inr(run.netPay)}`)) return;
    setBusyRunId(run._id);
    try {
      const res = await api.post(`/payroll/runs/${run._id}/approve`);
      if (res.data.success) {
        toast.success('Approved and payslip sent!');
        fetchRuns();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve.');
    } finally {
      setBusyRunId(null);
    }
  };

  const handleHold = async (run) => {
    setBusyRunId(run._id);
    try {
      await api.post(`/payroll/runs/${run._id}/hold`);
      toast.success('Put on hold — excluded from auto-approval.');
      fetchRuns();
    } catch {
      toast.error('Failed to hold run.');
    } finally {
      setBusyRunId(null);
    }
  };

  const handleResume = async (run) => {
    setBusyRunId(run._id);
    try {
      await api.post(`/payroll/runs/${run._id}/resume`);
      toast.success('Resumed.');
      fetchRuns();
    } catch {
      toast.error('Failed to resume run.');
    } finally {
      setBusyRunId(null);
    }
  };

  const handleResend = async (run) => {
    setBusyRunId(run._id);
    try {
      await api.post(`/payroll/runs/${run._id}/resend`);
      toast.success('Payslip re-sent.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend.');
    } finally {
      setBusyRunId(null);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await api.put('/payroll/settings', settings);
      if (res.data.success) {
        toast.success('Payroll settings updated.');
        setSettings(res.data.settings);
        setShowSettings(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6 text-app-text">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Payroll</h1>
          <p className="text-app-text-muted text-sm mt-1">
            Review, adjust, and approve monthly payroll. Payslips auto-send by day {settings?.generationDay ?? '11'} of each month.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-app-card border border-app-border hover:bg-surface-variant text-app-text font-medium transition-all cursor-pointer text-sm"
          >
            <SettingsIcon size={16} /> Settings
          </button>
          <button
            onClick={handleGeneratePayroll}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition-all shadow-lg hover:shadow-primary/20 active:scale-[0.98] cursor-pointer disabled:opacity-60"
          >
            <PlayCircle size={18} /> {isGenerating ? 'Running...' : 'Run Payroll'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-app-card p-4 rounded-xl border border-app-border">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${inputClass} w-auto`}>
          {MONTH_NAMES.map((m, idx) => <option key={m} value={idx + 1} className="bg-app-bg text-app-text">{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${inputClass} w-auto`}>
          {years.map((y) => <option key={y} value={y} className="bg-app-bg text-app-text">{y}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="All" className="bg-app-bg text-app-text">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s} className="bg-app-bg text-app-text">{s}</option>)}
        </select>
        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={`${inputClass} w-auto`}>
          <option value="All" className="bg-app-bg text-app-text">All Employees</option>
          {employeeOptions.map((e) => <option key={e._id} value={e._id} className="bg-app-bg text-app-text">{e.firstName} {e.lastName}</option>)}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-app-card p-4 rounded-xl border border-app-border">
          <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Gross Earnings</p>
          <p className="text-2xl font-bold mt-1 text-app-text">{inr(totals.gross)}</p>
        </div>
        <div className="bg-app-card p-4 rounded-xl border border-app-border">
          <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Total Deductions</p>
          <p className="text-2xl font-bold mt-1 text-app-text">{inr(totals.deductions)}</p>
        </div>
        <div className="bg-app-card p-4 rounded-xl border border-app-border">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">Net Payout</p>
          <p className="text-2xl font-bold mt-1 text-primary">{inr(totals.net)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-app-card rounded-xl border border-app-border overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-20">
            <IndianRupee className="mx-auto text-app-text-muted mb-3" size={32} />
            <p className="text-app-text-muted">No payroll runs for {MONTH_NAMES[month - 1]} {year} yet.</p>
            <p className="text-app-text-muted text-xs mt-1">Click "Run Payroll" to calculate it now.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-app-border text-xs text-app-text-muted uppercase tracking-wider bg-app-bg">
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Gross</th>
                  <th className="px-6 py-4 font-semibold">Deductions</th>
                  <th className="px-6 py-4 font-semibold">Net Pay</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border text-sm">
                {runs.filter(r => r.employeeId).map((run) => {
                  const isExpanded = expandedRunId === run._id;
                  const isEditable = ['Draft', 'UnderReview', 'OnHold'].includes(run.status);
                  const draft = getDraft(run);
                  const isBusy = busyRunId === run._id;
                  return (
                    <>
                      <tr key={run._id} className="hover:bg-surface-variant transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-app-text">{run.employeeId?.firstName} {run.employeeId?.lastName}</div>
                          <div className="text-xs text-app-text-muted">{run.employeeId?.roleDept}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-app-text">{inr(run.grossEarnings)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-app-text">{inr(run.totalDeductions)}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-app-text">{inr(run.netPay)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_CLASS[run.status]}`}>{run.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditable && run.status !== 'OnHold' && (
                              <button disabled={isBusy} onClick={() => handleApprove(run)} title="Approve & Send"
                                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer disabled:opacity-50">
                                <CheckCircle2 size={16} />
                              </button>
                            )}
                            {isEditable && run.status !== 'OnHold' && (
                              <button disabled={isBusy} onClick={() => handleHold(run)} title="Put on hold"
                                className="p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 transition-colors cursor-pointer disabled:opacity-50">
                                <PauseCircle size={16} />
                              </button>
                            )}
                            {run.status === 'OnHold' && (
                              <button disabled={isBusy} onClick={() => handleResume(run)} title="Resume"
                                className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors cursor-pointer disabled:opacity-50">
                                <PlayCircle size={16} />
                              </button>
                            )}
                            {['Generated', 'Sent'].includes(run.status) && (
                              <button disabled={isBusy} onClick={() => handleResend(run)} title="Resend payslip email"
                                className="p-1.5 rounded-lg bg-surface-variant hover:bg-app-border text-app-text-muted hover:text-app-text transition-colors cursor-pointer disabled:opacity-50">
                                <Send size={16} />
                              </button>
                            )}
                            {run.payslipId?.pdfUrl && (
                              <a href={run.payslipId.pdfUrl} target="_blank" rel="noopener noreferrer" title="Download payslip PDF"
                                className="p-1.5 rounded-lg bg-surface-variant hover:bg-app-border text-app-text-muted hover:text-app-text transition-colors cursor-pointer inline-flex">
                                <Download size={16} />
                              </a>
                            )}
                            <button
                              onClick={() => setExpandedRunId(isExpanded ? null : run._id)}
                              className="p-1.5 rounded-lg bg-surface-variant hover:bg-app-border text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${run._id}-detail`} className="bg-app-bg">
                          <td colSpan="6" className="px-6 pb-6 pt-3">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Breakdown */}
                              <div className="space-y-4">
                                <div>
                                  <div className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">Earnings</div>
                                  <div className="text-xs space-y-1">
                                    {Object.entries(run.earnings).filter(([, v]) => v).map(([k, v]) => (
                                      <div key={k} className="flex justify-between text-app-text-muted">
                                        <span className="capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                                        <span className="text-app-text font-medium">{inr(v)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">Deductions</div>
                                  <div className="text-xs space-y-1">
                                    {Object.entries(run.deductions).filter(([k, v]) => k !== 'otherDeductionsReason' && v).map(([k, v]) => (
                                      <div key={k} className="flex justify-between text-app-text-muted">
                                        <span className="capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                                        <span className="text-app-text font-medium">{inr(v)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">Attendance</div>
                                  <div className="text-xs text-app-text-muted">
                                    {run.totalDaysInMonth} days · {run.presentDays} present · {run.paidLeaveDays} paid leave · <span className="text-rose-400">{run.lopDays} LOP</span>
                                  </div>
                                </div>
                                {run.salaryBreakup?.length > 0 && (
                                  <div>
                                    <div className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">Salary Proration</div>
                                    <div className="text-xs space-y-1">
                                      {run.salaryBreakup.map((seg, i) => (
                                        <div key={i} className="flex justify-between text-app-text-muted">
                                          <span>{new Date(seg.fromDate).toLocaleDateString('en-IN')} – {new Date(seg.toDate).toLocaleDateString('en-IN')} ({seg.daysApplicable}d)</span>
                                          <span className="text-app-text font-medium">{inr(seg.proratedAmount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Editable fields */}
                              <div className="space-y-3">
                                <div className="text-xs font-bold text-app-text-muted uppercase tracking-wider">
                                  {isEditable ? 'Adjustments' : 'Adjustments (locked — already ' + run.status + ')'}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className={fieldLabelClass}>Bonus (₹)</label>
                                    <input type="number" min="0" disabled={!isEditable} className={inputClass} value={draft.bonus}
                                      onChange={(e) => updateDraft(run._id, 'bonus', Number(e.target.value))} />
                                  </div>
                                  <div>
                                    <label className={fieldLabelClass}>Incentive (₹)</label>
                                    <input type="number" min="0" disabled={!isEditable} className={inputClass} value={draft.incentive}
                                      onChange={(e) => updateDraft(run._id, 'incentive', Number(e.target.value))} />
                                  </div>
                                  <div>
                                    <label className={fieldLabelClass}>Reimbursement (₹)</label>
                                    <input type="number" min="0" disabled={!isEditable} className={inputClass} value={draft.reimbursement}
                                      onChange={(e) => updateDraft(run._id, 'reimbursement', Number(e.target.value))} />
                                  </div>
                                  <div>
                                    <label className={fieldLabelClass}>Arrears (₹)</label>
                                    <input type="number" min="0" disabled={!isEditable} className={inputClass} value={draft.arrears}
                                      onChange={(e) => updateDraft(run._id, 'arrears', Number(e.target.value))} />
                                  </div>
                                  <div>
                                    <label className={fieldLabelClass}>TDS (₹)</label>
                                    <input type="number" min="0" disabled={!isEditable} className={inputClass} value={draft.tds}
                                      onChange={(e) => updateDraft(run._id, 'tds', Number(e.target.value))} />
                                  </div>
                                  <div>
                                    <label className={fieldLabelClass}>Other Deductions (₹)</label>
                                    <input type="number" min="0" disabled={!isEditable} className={inputClass} value={draft.otherDeductions}
                                      onChange={(e) => updateDraft(run._id, 'otherDeductions', Number(e.target.value))} />
                                  </div>
                                </div>
                                {draft.otherDeductions > 0 && (
                                  <div>
                                    <label className={fieldLabelClass}>Other Deduction Reason</label>
                                    <input type="text" disabled={!isEditable} className={inputClass} value={draft.otherDeductionsReason}
                                      onChange={(e) => updateDraft(run._id, 'otherDeductionsReason', e.target.value)} />
                                  </div>
                                )}
                                <div>
                                  <label className={fieldLabelClass}>Remarks</label>
                                  <textarea disabled={!isEditable} className={`${inputClass} h-16 resize-none`} value={draft.remarks}
                                    onChange={(e) => updateDraft(run._id, 'remarks', e.target.value)} />
                                </div>
                                {isEditable && (
                                  <button
                                    onClick={() => handleSaveDraft(run)}
                                    disabled={isBusy}
                                    className="px-4 py-2 rounded-lg bg-app-card border border-app-border hover:bg-surface-variant text-app-text font-medium text-sm transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    {isBusy ? 'Saving...' : 'Save Adjustments'}
                                  </button>
                                )}
                              </div>
                            </div>
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

      {/* Payroll Settings Modal */}
      {showSettings && settings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="bg-app-card border border-app-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-app-border bg-app-bg">
              <h2 className="text-lg font-bold text-app-text">Payroll Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-app-text-muted hover:text-app-text cursor-pointer"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={fieldLabelClass}>Auto-generate & send day (1–28) <span className="text-primary">*</span></label>
                <input
                  type="number" min="1" max="28" className={inputClass}
                  value={settings.generationDay}
                  onChange={(e) => setSettings((s) => ({ ...s, generationDay: Number(e.target.value) }))}
                />
                <p className="text-[11px] text-app-text-muted mt-1">On this day each month, last month's payroll auto-sends for every employee.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-app-text cursor-pointer">
                <input
                  type="checkbox" checked={!!settings.autoApproveOnGenerationDay}
                  onChange={(e) => setSettings((s) => ({ ...s, autoApproveOnGenerationDay: e.target.checked }))}
                  className="w-4 h-4 rounded border-app-border cursor-pointer"
                />
                Auto-approve runs still in Draft/Under Review on the generation day
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabelClass}>PF — Employee %</label>
                  <input type="number" min="0" max="100" className={inputClass} value={settings.pf?.employeePercent ?? 12}
                    onChange={(e) => setSettings((s) => ({ ...s, pf: { ...s.pf, employeePercent: Number(e.target.value) } }))} />
                </div>
                <div>
                  <label className={fieldLabelClass}>PF Wage Ceiling (₹)</label>
                  <input type="number" min="0" className={inputClass} value={settings.pf?.wageCeiling ?? 15000}
                    onChange={(e) => setSettings((s) => ({ ...s, pf: { ...s.pf, wageCeiling: Number(e.target.value) } }))} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-app-text cursor-pointer">
                <input
                  type="checkbox" checked={!!settings.pf?.enabled}
                  onChange={(e) => setSettings((s) => ({ ...s, pf: { ...s.pf, enabled: e.target.checked } }))}
                  className="w-4 h-4 rounded border-app-border cursor-pointer"
                />
                PF deduction enabled
              </label>
              <div>
                <label className={fieldLabelClass}>Default Professional Tax (₹/month)</label>
                <input type="number" min="0" className={inputClass} value={settings.professionalTax?.amount ?? 0}
                  onChange={(e) => setSettings((s) => ({ ...s, professionalTax: { ...s.professionalTax, amount: Number(e.target.value) } }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-app-text cursor-pointer">
                <input
                  type="checkbox" checked={!!settings.professionalTax?.enabled}
                  onChange={(e) => setSettings((s) => ({ ...s, professionalTax: { ...s.professionalTax, enabled: e.target.checked } }))}
                  className="w-4 h-4 rounded border-app-border cursor-pointer"
                />
                Professional Tax deduction enabled
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowSettings(false)} className="flex-1 py-2.5 rounded-lg border border-app-border text-app-text-muted hover:bg-surface-variant hover:text-app-text transition-all cursor-pointer text-sm">
                  Cancel
                </button>
                <button onClick={handleSaveSettings} disabled={savingSettings} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all cursor-pointer text-sm disabled:opacity-60">
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
