import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Target, Plus, Trash2, AlertCircle, CheckCircle, Info } from 'lucide-react';

const METRIC_UNITS = {
  Revenue:         '₹',
  LeadCount:       'count',
  CampaignROAS:    'x (ratio)',
  OnTimeDelivery:  '%',
  ProductivityPct: '%',
  AttendancePct:   '%',
  FollowUpQuality: 'score (0-100)',
  BillableHours:   'hrs'
};

const METRIC_LABELS = {
  Revenue:         'Revenue Closed (₹)',
  LeadCount:       'Qualified Lead Count',
  CampaignROAS:    'Campaign ROAS',
  OnTimeDelivery:  'On-Time Delivery %',
  ProductivityPct: 'Productivity %',
  AttendancePct:   'Attendance %',
  FollowUpQuality: 'Follow-up Quality Score',
  BillableHours:   'Billable Hours'
};

const METRIC_SOURCE = {
  Revenue:         'Auto — from CRM (deal value)',
  LeadCount:       'Auto — from CRM (Qualified/Won leads)',
  CampaignROAS:    'Manual — manager entry required',
  OnTimeDelivery:  'Auto — from task completion data',
  ProductivityPct: 'Auto — from timesheet WorkLog',
  AttendancePct:   'Auto — from attendance log',
  FollowUpQuality: 'Manual — manager entry required',
  BillableHours:   'Auto — from timesheet WorkLog'
};

const emptyKPI = () => ({ metricType: 'Revenue', targetValue: '', weightage: '' });

const PerformanceGoalAssigner = () => {
  const [cycles, setCycles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [presets, setPresets] = useState({});
  const [metricTypes, setMetricTypes] = useState([]);

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
          api.get('/performance/cycles'),
          api.get('/employees'),
          api.get('/performance/presets')
        ]);
        const activeCycles = cycleRes.data.cycles?.filter(c => c.status === 'Active' || c.status === 'Draft') || [];
        setCycles(activeCycles);
        setEmployees(empRes.data.employees || []);
        setPresets(presetRes.data.presets || {});
        setMetricTypes(presetRes.data.metricTypes || []);

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
    api.get(`/performance/targets/employee/${selectedEmployee}/${selectedCycle}`)
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
          unit: METRIC_UNITS[k.metricType] || ''
        }))
      };
      const res = await api.post('/performance/targets', payload);
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
      <div className="flex justify-center items-center min-h-screen bg-[#0d0d0f]">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
      </div>
    );
  }

  const selectedEmpObj = employees.find(e => e._id === selectedEmployee);

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <Target className="text-orange-500" size={28} />
          KPI Goal Assigner
        </h1>
        <p className="text-gray-400 text-sm mt-1">Assign weighted KPI targets to employees for a performance cycle.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 items-start">

        {/* Left: Config Panel */}
        <div className="space-y-4">
          {/* Cycle Selector */}
          <div className="bg-[#141416] border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-gray-300 uppercase tracking-wider">Step 1 — Select Cycle & Employee</h3>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Performance Cycle</label>
              <select
                value={selectedCycle}
                onChange={e => setSelectedCycle(e.target.value)}
                className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
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
              <label className="block text-xs text-gray-400 mb-1.5">Employee</label>
              <select
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
                className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">Select employee...</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} — {emp.roleDept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Role Presets */}
          <div className="bg-[#141416] border border-white/5 rounded-2xl p-5 space-y-3">
            <div>
              <h3 className="font-bold text-sm text-gray-300 uppercase tracking-wider">Step 2 — Load Preset</h3>
              <p className="text-xs text-gray-500 mt-1">Load role-based default KPIs. You can edit after loading.</p>
            </div>
            <div className="space-y-2">
              {Object.keys(presets).map(key => (
                <button
                  key={key}
                  onClick={() => loadPreset(key)}
                  className="w-full text-left px-4 py-2.5 rounded-lg bg-white/[0.03] hover:bg-orange-500/10 border border-white/5 hover:border-orange-500/20 text-sm text-gray-300 hover:text-orange-400 transition-all cursor-pointer"
                >
                  <div className="font-bold">{key}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {presets[key].map(p => `${p.metricType} (${p.weightage}%)`).join(' · ')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Employee Info */}
          {selectedEmpObj && (
            <div className="bg-[#141416] border border-white/5 rounded-2xl p-5">
              <h3 className="font-bold text-sm text-gray-300 uppercase tracking-wider mb-3">Selected Employee</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-600/10 text-orange-500 flex items-center justify-center font-bold text-sm border border-orange-500/15">
                  {selectedEmpObj.firstName.charAt(0)}{selectedEmpObj.lastName.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{selectedEmpObj.firstName} {selectedEmpObj.lastName}</div>
                  <div className="text-xs text-gray-400">{selectedEmpObj.roleDept} · {selectedEmpObj.employeeId}</div>
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
        <div className="bg-[#141416] border border-white/5 rounded-2xl p-5 space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-gray-300 uppercase tracking-wider">Step 3 — Define KPI Targets</h3>
            <button
              onClick={addKPI}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-xs font-bold transition-colors cursor-pointer border border-orange-500/20"
            >
              <Plus size={14} /> Add KPI
            </button>
          </div>

          {/* Weightage meter */}
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Weightage</span>
              <div className={`flex items-center gap-1.5 text-sm font-black ${weightOk ? 'text-emerald-400' : 'text-orange-400'}`}>
                {weightOk ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {totalWeight}% {weightOk ? '✓ Ready' : `(need ${100 - totalWeight > 0 ? '+' : ''}${100 - totalWeight}%)`}
              </div>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${weightOk ? 'bg-emerald-500' : totalWeight > 100 ? 'bg-rose-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(totalWeight, 100)}%` }}
              />
            </div>
          </div>

          {/* KPI Rows */}
          <div className="space-y-3">
            {kpis.map((kpi, idx) => (
              <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">KPI #{idx + 1}</div>
                  <button onClick={() => removeKPI(idx)} className="text-rose-400 hover:text-rose-300 cursor-pointer transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Metric Type</label>
                  <select
                    value={kpi.metricType}
                    onChange={e => handleKPIChange(idx, 'metricType', e.target.value)}
                    className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    {metricTypes.map(m => (
                      <option key={m} value={m}>{METRIC_LABELS[m] || m}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-600">
                    <Info size={10} /> {METRIC_SOURCE[kpi.metricType]}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Target Value ({METRIC_UNITS[kpi.metricType]})</label>
                    <input
                      type="number"
                      min="0"
                      value={kpi.targetValue}
                      onChange={e => handleKPIChange(idx, 'targetValue', e.target.value)}
                      placeholder="e.g. 600000"
                      className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Weightage (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={kpi.weightage}
                      onChange={e => handleKPIChange(idx, 'weightage', e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full text-sm rounded-lg border border-white/10 bg-[#1e1e21] px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isSaving || !weightOk || !selectedCycle || !selectedEmployee}
            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-orange-500/20 text-sm"
          >
            {isSaving ? 'Saving KPI Targets...' : `Save ${kpis.length} KPI Target${kpis.length > 1 ? 's' : ''}`}
          </button>

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
