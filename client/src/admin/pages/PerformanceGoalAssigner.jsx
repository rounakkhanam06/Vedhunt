import { useState, useEffect, useCallback } from 'react';
import { usePageAccess } from '../../shared/crmAccess';
import toast from 'react-hot-toast';
import { Target, Plus, Trash2, AlertCircle, CheckCircle, Info, Sparkles } from 'lucide-react';

const fieldClass = 'w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-orange-500';

/** Admin-defined KPIs for designations the built-in list doesn't cover (services/kpiMetrics.js on the server). */
function CustomKpiPanel({ http, root, metricDefs, units, canEdit, onChanged }) {
  const [form, setForm] = useState({ label: '', unit: 'count', lowerIsBetter: false });
  const [busy, setBusy] = useState(false);
  const custom = Object.entries(metricDefs).filter(([, d]) => d.custom && !d.archived);

  const create = async (e) => {
    e.preventDefault();
    if (form.label.trim().length < 2) { toast.error('Enter a KPI name.'); return; }
    setBusy(true);
    try {
      await http.post(`${root}/performance/custom-metrics`, form);
      toast.success(`Custom KPI "${form.label.trim()}" created. Pick it under Metric Type.`);
      setForm({ label: '', unit: 'count', lowerIsBetter: false });
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create the KPI.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (key, label) => {
    if (!window.confirm(`Remove "${label}"? It won't be offered for new KPIs. Employees who already have it keep it.`)) return;
    try {
      await http.delete(`${root}/performance/custom-metrics/${key}`);
      toast.success('Custom KPI removed.');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove the KPI.');
    }
  };

  return (
    <div className="bg-app-card border border-app-border rounded-2xl p-5 space-y-3">
      <div>
        <h3 className="font-bold text-sm text-app-text-muted uppercase tracking-wider flex items-center gap-2"><Sparkles size={14} className="text-orange-400" /> Custom KPIs</h3>
        <p className="text-xs text-app-text-muted mt-1">Create your own KPI for any designation (e.g. Designs Delivered, GST Filings On Time). It counts in the KPI score; the manager enters the achieved value in the Performance Matrix.</p>
      </div>
      {custom.length > 0 && (
        <ul className="divide-y divide-app-border border border-app-border rounded-lg">
          {custom.map(([key, d]) => (
            <li key={key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{d.label} <span className="text-[11px] text-app-text-muted">({d.unit}{d.lowerIsBetter ? ', lower is better' : ''})</span></span>
              {canEdit && (
                <button type="button" onClick={() => remove(key, d.label)} aria-label={`Remove ${d.label}`} className="text-rose-400 hover:text-rose-300 cursor-pointer shrink-0"><Trash2 size={13} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form onSubmit={create} className="space-y-2">
          <input value={form.label} maxLength={60} placeholder="KPI name, e.g. Designs Delivered" onChange={(e) => setForm({ ...form, label: e.target.value })} className={fieldClass} />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.unit} aria-label="Unit" onChange={(e) => setForm({ ...form, unit: e.target.value })} className={fieldClass}>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-app-text cursor-pointer">
              <input type="checkbox" checked={form.lowerIsBetter} onChange={(e) => setForm({ ...form, lowerIsBetter: e.target.checked })} />
              Lower is better
            </label>
          </div>
          <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-xs font-bold border border-orange-500/20 cursor-pointer disabled:opacity-50">
            <Plus size={14} /> {busy ? 'Creating…' : 'Create Custom KPI'}
          </button>
        </form>
      )}
    </div>
  );
}

const emptyKPI = () => ({ metricType: 'Revenue', targetValue: '', weightage: '' });

const PerformanceGoalAssigner = () => {
  // Admin panel (role) or Employee Portal (person-wise grant) — shared/crmAccess.js
  const { http, root, allowed } = usePageAccess();
  const [cycles, setCycles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [presets, setPresets] = useState({});
  const [metricTypes, setMetricTypes] = useState([]);
  // Labels/units/source come from the server's KPI catalog (models/KPITarget.js)
  const [metricDefs, setMetricDefs] = useState({});
  const [units, setUnits] = useState([]);

  const [selectedCycle, setSelectedCycle] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [kpis, setKpis] = useState([emptyKPI()]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Existing targets for selected employee+cycle
  const [existingTargets, setExistingTargets] = useState([]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [cycleRes, empRes, presetRes] = await Promise.all([
          http.get(`${root}/performance/cycles`),
          http.get(`${root}/employees`),
          http.get(`${root}/performance/presets`)
        ]);
        const activeCycles = cycleRes.data.cycles?.filter(c => c.status === 'Active' || c.status === 'Draft') || [];
        setCycles(activeCycles);
        setEmployees(empRes.data.employees || []);
        setPresets(presetRes.data.presets || {});
        setMetricTypes(presetRes.data.metricTypes || []);
        setMetricDefs(presetRes.data.metricDefs || {});
        setUnits(presetRes.data.units || []);

        // Auto-select active cycle
        const active = cycleRes.data.cycles?.find(c => c.status === 'Active');
        if (active) setSelectedCycle(active._id);
      } catch {
        toast.error('Failed to load data.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Load existing targets when employee+cycle changes
  useEffect(() => {
    if (!selectedCycle || !selectedEmployee) {
      setExistingTargets([]);
      setKpis([emptyKPI()]);
      return;
    }
    http.get(`${root}/performance/targets/employee/${selectedEmployee}/${selectedCycle}`)
      .then(res => {
        if (res.data.success && res.data.targets.length > 0) {
          setExistingTargets(res.data.targets);
          setKpis(res.data.targets.map(t => ({
            metricType: t.metricType,
            targetValue: t.targetValue,
            weightage: t.weightage
          })));
        } else {
          setExistingTargets([]);
          setKpis([emptyKPI()]);
        }
      })
      .catch(() => {});
  }, [selectedEmployee, selectedCycle]);

  const totalWeight = kpis.reduce((s, k) => s + Number(k.weightage || 0), 0);
  const weightOk = Math.round(totalWeight) === 100;

  const handleKPIChange = useCallback((idx, field, value) => {
    setKpis(prev => prev.map((k, i) => i === idx ? { ...k, [field]: value } : k));
  }, []);

  const addKPI = () => setKpis(prev => [...prev, emptyKPI()]);

  const removeKPI = (idx) => {
    if (kpis.length === 1) { toast.error('At least one KPI is required.'); return; }
    setKpis(prev => prev.filter((_, i) => i !== idx));
  };

  const loadPreset = (presetKey) => {
    const preset = presets[presetKey];
    if (!preset) return;
    setKpis(preset.map(p => ({
      metricType: p.metricType,
      targetValue: p.targetValue,
      weightage: p.weightage
    })));
    toast.success(`"${presetKey}" preset loaded! Review and adjust as needed.`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCycle || !selectedEmployee) {
      toast.error('Please select a cycle and employee.');
      return;
    }
    if (!weightOk) {
      toast.error(`Total weightage must equal 100%. Current: ${totalWeight}%`);
      return;
    }
    for (const k of kpis) {
      if (!k.targetValue || Number(k.targetValue) <= 0) {
        toast.error('All KPIs must have a valid target value > 0.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        cycleId: selectedCycle,
        employeeId: selectedEmployee,
        kpis: kpis.map(k => ({
          metricType: k.metricType,
          targetValue: Number(k.targetValue),
          weightage: Number(k.weightage),
          unit: metricDefs[k.metricType]?.unit || ''
        }))
      };
      const res = await http.post(`${root}/performance/targets`, payload);
      if (res.data.success) {
        toast.success(`KPI targets assigned successfully! (${kpis.length} KPIs)`);
        setExistingTargets(res.data.targets);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign KPI targets.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
      </div>
    );
  }

  const selectedEmpObj = employees.find(e => e._id === selectedEmployee);
  const canEdit = allowed('performance.manage', 'performance', 'edit');

  // Re-read the catalog after a custom KPI is created or removed
  const reloadMetrics = () => http.get(`${root}/performance/presets`).then((r) => {
    setMetricTypes(r.data.metricTypes || []);
    setMetricDefs(r.data.metricDefs || {});
  }).catch(() => {});

  return (
    <div className="text-app-text space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <Target className="text-orange-500" size={28} />
          KPI Goal Assigner
        </h1>
        <p className="text-app-text-muted text-sm mt-1">Assign weighted KPI targets to employees for a performance cycle.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 items-start">

        {/* Left: Config Panel */}
        <div className="space-y-4">
          {/* Cycle Selector */}
          <div className="bg-app-card border border-app-border rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-app-text-muted uppercase tracking-wider">Step 1 — Select Cycle & Employee</h3>
            <div>
              <label className="block text-xs text-app-text-muted mb-1.5">Performance Cycle</label>
              <select
                value={selectedCycle}
                onChange={e => setSelectedCycle(e.target.value)}
                className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">Select cycle...</option>
                {cycles.map(c => (
                  <option key={c._id} value={c._id}>{c.title} [{c.status}]</option>
                ))}
              </select>
              {cycles.length === 0 && (
                <p className="text-xs text-orange-400 mt-1.5">⚠ No active/draft cycles. Create one first.</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-app-text-muted mb-1.5">Employee</label>
              <select
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
                className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">Select employee...</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} — {emp.roleDept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Role Presets */}
          <div className="bg-app-card border border-app-border rounded-2xl p-5 space-y-3">
            <div>
              <h3 className="font-bold text-sm text-app-text-muted uppercase tracking-wider">Step 2 — Load Preset</h3>
              <p className="text-xs text-app-text-muted mt-1">Load role-based default KPIs. You can edit after loading.</p>
            </div>
            <div className="space-y-2">
              {Object.keys(presets).map(key => (
                <button
                  key={key}
                  onClick={() => loadPreset(key)}
                  className="w-full text-left px-4 py-2.5 rounded-lg bg-app-bg hover:bg-orange-500/10 border border-app-border hover:border-orange-500/20 text-sm text-app-text-muted hover:text-orange-400 transition-all cursor-pointer"
                >
                  <div className="font-bold">{key}</div>
                  <div className="text-xs text-app-text-muted mt-0.5">
                    {presets[key].map(p => `${p.metricType} (${p.weightage}%)`).join(' · ')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <CustomKpiPanel http={http} root={root} metricDefs={metricDefs} units={units} canEdit={canEdit} onChanged={reloadMetrics} />

          {/* Employee Info */}
          {selectedEmpObj && (
            <div className="bg-app-card border border-app-border rounded-2xl p-5">
              <h3 className="font-bold text-sm text-app-text-muted uppercase tracking-wider mb-3">Selected Employee</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-600/10 text-orange-500 flex items-center justify-center font-bold text-sm border border-orange-500/15">
                  {selectedEmpObj.firstName.charAt(0)}{selectedEmpObj.lastName.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-app-text text-sm">{selectedEmpObj.firstName} {selectedEmpObj.lastName}</div>
                  <div className="text-xs text-app-text-muted">{selectedEmpObj.roleDept} · {selectedEmpObj.employeeId}</div>
                </div>
              </div>
              {existingTargets.length > 0 && (
                <div className="mt-3 bg-orange-500/5 border border-orange-500/15 rounded-lg p-3 text-xs text-orange-300">
                  ⚠ This employee already has {existingTargets.length} KPIs for this cycle. Saving will replace them.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: KPI Builder */}
        <div className="bg-app-card border border-app-border rounded-2xl p-5 space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-app-text-muted uppercase tracking-wider">Step 3 — Define KPI Targets</h3>
            <button
              onClick={addKPI}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-xs font-bold transition-colors cursor-pointer border border-orange-500/20"
            >
              <Plus size={14} /> Add KPI
            </button>
          </div>

          {/* Weightage meter */}
          <div className="bg-app-bg rounded-xl p-4 border border-app-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-app-text-muted font-bold uppercase tracking-wider">Total Weightage</span>
              <div className={`flex items-center gap-1.5 text-sm font-black ${weightOk ? 'text-emerald-400' : 'text-orange-400'}`}>
                {weightOk ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {totalWeight}% {weightOk ? '✓ Ready' : `(need ${100 - totalWeight > 0 ? '+' : ''}${100 - totalWeight}%)`}
              </div>
            </div>
            <div className="w-full bg-app-border rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${weightOk ? 'bg-emerald-500' : totalWeight > 100 ? 'bg-rose-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(totalWeight, 100)}%` }}
              />
            </div>
          </div>

          {/* KPI Rows */}
          <div className="space-y-3">
            {kpis.map((kpi, idx) => (
              <div key={idx} className="bg-app-bg border border-app-border rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="text-xs font-bold text-app-text-muted uppercase tracking-wider">KPI #{idx + 1}</div>
                  <button onClick={() => removeKPI(idx)} className="text-rose-400 hover:text-rose-300 cursor-pointer transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-app-text-muted mb-1">Metric Type</label>
                  <select
                    value={kpi.metricType}
                    onChange={e => handleKPIChange(idx, 'metricType', e.target.value)}
                    className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    {(metricTypes.includes(kpi.metricType) ? metricTypes : [...metricTypes, kpi.metricType]).map(m => (
                      <option key={m} value={m}>{metricDefs[m]?.label || m}{metricDefs[m]?.custom ? ' (custom)' : ''}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-app-text-muted">
                    <Info size={10} /> {metricDefs[kpi.metricType]?.auto ? 'Auto — ' : ''}{metricDefs[kpi.metricType]?.source}{metricDefs[kpi.metricType]?.lowerIsBetter ? ' · lower is better' : ''}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-app-text-muted mb-1">Target Value ({metricDefs[kpi.metricType]?.unit})</label>
                    <input
                      type="number"
                      min="0"
                      value={kpi.targetValue}
                      onChange={e => handleKPIChange(idx, 'targetValue', e.target.value)}
                      placeholder="e.g. 600000"
                      className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-app-text-muted mb-1">Weightage (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={kpi.weightage}
                      onChange={e => handleKPIChange(idx, 'weightage', e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Submit */}
          {allowed('performance.manage', 'performance', 'edit') && (<button
            onClick={handleSubmit}
            disabled={isSaving || !weightOk || !selectedCycle || !selectedEmployee}
            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-orange-500/20 text-sm"
          >
            {isSaving ? 'Saving KPI Targets...' : `Save ${kpis.length} KPI Target${kpis.length > 1 ? 's' : ''}`}
          </button>)}

          {!weightOk && (
            <p className="text-xs text-orange-400 text-center">
              Total weightage must equal exactly 100% before saving.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceGoalAssigner;
