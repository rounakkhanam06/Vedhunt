import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clientService from '../../services/clientService';
import StatusBadge from '../components/StatusBadge';
import HoursRing from '../components/HoursRing';
import { RefreshCcw, AlertTriangle, Bell, RefreshCw } from 'lucide-react';

const RetainersTab = () => {
  const [retainers, setRetainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    clientService
      .getRetainers({ limit: 20 })
      .then((res) => setRetainers(res.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRenewalRequest = () => {
    navigate('/client/dashboard?tab=support&presubject=Renewal Request&precategory=General Inquiry');
  };

  const progressPct = (start, end) => {
    if (!start || !end) return 0;
    const total = new Date(end) - new Date(start);
    const elapsed = Date.now() - new Date(start);
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const daysLeft = (end) => {
    if (!end) return null;
    const diff = Math.ceil((new Date(end) - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white text-2xl font-bold">Retainers &amp; Contracts</h2>
          <p className="text-[#D1D5DB] text-sm mt-1">Your active retainer agreements and support quotas</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface/50 border border-border-default text-[#D1D5DB] hover:text-white text-sm transition-all cursor-pointer"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" />
        </div>
      ) : retainers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <RefreshCcw size={40} className="text-[#2B2A2A]" />
          <p className="text-[#9CA3AF] text-sm">No retainer agreements found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {retainers.map((r) => {
            const days = daysLeft(r.contractEndDate);
            const nearingExpiry = r.isNearingExpiry;
            const contractPct = progressPct(r.contractStartDate, r.contractEndDate);

            return (
              <div key={r._id} className="bg-bg-card border border-border-default rounded-2xl p-5 space-y-5">
                {/* Expiry Warning Banner */}
                {nearingExpiry && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#F59E0B]/[0.08] border border-[#F59E0B]/25">
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} className="text-[#F59E0B] shrink-0" />
                      <div>
                        <p className="text-[#F59E0B] text-sm font-medium">Contract Expiring Soon</p>
                        <p className="text-[#D1D5DB] text-xs">
                          Your retainer expires on{' '}
                          <span className="text-white">
                            {new Date(r.contractEndDate).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'long', year: 'numeric',
                            })}
                          </span>{' '}
                          ({days} days left)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRenewalRequest}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-medium hover:bg-[#F59E0B]/25 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Bell size={13} /> Request Renewal
                    </button>
                  </div>
                )}

                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold text-lg">{r.packageName}</h3>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-[#D1D5DB] text-sm mt-1">
                      ₹{(r.monthlyAmount || 0).toLocaleString('en-IN')} / {r.billingCycle?.toLowerCase() || 'month'}
                    </p>
                    <p className="text-[#9CA3AF] text-xs">{r.retainerId}</p>
                  </div>

                  {/* Hours Ring */}
                  <HoursRing
                    used={r.hoursUsedThisMonth || 0}
                    total={r.supportHoursPerMonth || 0}
                    size={90}
                  />
                </div>

                {/* Contract Duration Bar */}
                <div>
                  <div className="flex justify-between text-xs text-[#D1D5DB] mb-1.5">
                    <span>
                      {r.contractStartDate
                        ? new Date(r.contractStartDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                        : 'Start'}
                    </span>
                    <span className={days !== null && days <= 15 && r.status === 'Active' ? 'text-[#F59E0B] font-medium' : ''}>
                      {r.contractEndDate
                        ? new Date(r.contractEndDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                        : 'End'}
                    </span>
                  </div>
                  <div className="h-2 bg-[#2B2A2A] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        r.status === 'Active'
                          ? days !== null && days <= 15
                            ? 'bg-[#F59E0B]'
                            : 'bg-gradient-to-r from-[#FF5A1F] to-[#FF7A47]'
                          : 'bg-[#6B7280]'
                      }`}
                      style={{ width: `${contractPct}%` }}
                    />
                  </div>
                  <p className="text-[#9CA3AF] text-xs mt-1 text-right">
                    {contractPct}% of contract period elapsed
                    {days !== null && ` · ${Math.max(0, days)} days remaining`}
                  </p>
                </div>

                {/* Hours summary */}
                <div className="flex gap-4 text-xs">
                  <div className="bg-bg-surface/40 border border-border-default rounded-lg px-3 py-2">
                    <p className="text-[#D1D5DB]">Monthly Quota</p>
                    <p className="text-white font-semibold">{r.supportHoursPerMonth} hrs</p>
                  </div>
                  <div className="bg-bg-surface/40 border border-border-default rounded-lg px-3 py-2">
                    <p className="text-[#D1D5DB]">Used This Month</p>
                    <p className="text-white font-semibold">{r.hoursUsedThisMonth || 0} hrs</p>
                  </div>
                  <div className="bg-bg-surface/40 border border-border-default rounded-lg px-3 py-2">
                    <p className="text-[#D1D5DB]">Remaining</p>
                    <p className={`font-semibold ${r.hoursRemaining <= 2 ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}>
                      {r.hoursRemaining ?? Math.max(0, (r.supportHoursPerMonth || 0) - (r.hoursUsedThisMonth || 0))} hrs
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RetainersTab;
