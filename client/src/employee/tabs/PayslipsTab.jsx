import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { Spinner } from '../components/PortalUI';
import { essGet, essKeys, openPdf } from '../lib/ess';
import { fmtDate } from '../lib/datetime';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STATUS_CLASS = {
  Paid: 'bg-emerald-500/10 text-emerald-400',
  Sent: 'bg-blue-500/10 text-blue-400',
  Processed: 'bg-surface-variant text-app-text-muted',
};
const rupees = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const pdfUrl = (slip, inline) => `/employee-portal/ess/payslips/${slip._id}/pdf${inline ? '?inline=1' : ''}`;
const fileName = (slip) => `Payslip-${slip.year}-${String(slip.month).padStart(2, '0')}.pdf`;

export default function PayslipsTab() {
  const { data: payslips = [], isLoading } = useQuery({ queryKey: essKeys.payslips, queryFn: () => essGet('/payslips').then((d) => d.payslips || []) });
  const [expandedId, setExpandedId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Always works — the server builds the PDF if the stored copy is missing
  const handlePdf = async (slip, view) => {
    setBusyId(slip._id);
    try {
      await openPdf(pdfUrl(slip, view), { download: !view, filename: fileName(slip) });
    } catch {
      toast.error('Could not open the payslip. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-app-card p-6 rounded-xl border border-app-border space-y-6">
      <h2 className="text-xl font-bold">Earnings & Payslips</h2>
      {isLoading ? <Spinner className="py-16" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Gross Earnings</th>
                <th className="py-3 px-4">Deductions</th>
                <th className="py-3 px-4">Net Payout</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Payslip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-sm">
              {payslips.map((slip) => {
                const isExpanded = expandedId === slip._id;
                return (
                  <Fragment key={slip._id}>
                    <tr className="hover:bg-surface-variant transition-colors">
                      <td className="py-3 px-4 font-bold text-app-text">{MONTH_NAMES[slip.month - 1]} {slip.year}</td>
                      <td className="py-3 px-4 text-app-text">{rupees(slip.grossEarnings)}</td>
                      <td className="py-3 px-4 text-rose-400">-{rupees(slip.totalDeductions)}</td>
                      <td className="py-3 px-4 font-bold text-primary">{rupees(slip.netPay)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_CLASS[slip.paymentStatus] || STATUS_CLASS.Processed}`}>{slip.paymentStatus}</span>
                        {slip.paidAt && <span className="block text-[11px] text-app-text-muted mt-0.5">on {fmtDate(slip.paidAt)}</span>}
                        {slip.paymentReference && <span className="block text-[11px] text-app-text-muted font-mono">UTR: {slip.paymentReference}</span>}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button type="button" onClick={() => handlePdf(slip, true)} disabled={busyId === slip._id}
                          className="text-primary hover:underline text-xs font-semibold mr-3 disabled:opacity-50 cursor-pointer">View</button>
                        <button type="button" onClick={() => handlePdf(slip, false)} disabled={busyId === slip._id}
                          className="text-primary hover:underline text-xs font-semibold mr-3 disabled:opacity-50 cursor-pointer">
                          {busyId === slip._id ? 'Preparing…' : 'Download'}
                        </button>
                        <button onClick={() => setExpandedId(isExpanded ? null : slip._id)} className="text-app-text-muted hover:text-app-text cursor-pointer" aria-label="Breakdown">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-app-bg">
                        <td colSpan="6" className="px-4 pb-5 pt-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            {[['Earnings', slip.earnings], ['Deductions', slip.deductions]].map(([title, values]) => (
                              <div key={title}>
                                <div className="font-bold text-app-text-muted uppercase tracking-wider mb-2">{title}</div>
                                <div className="space-y-1">
                                  {Object.entries(values || {}).filter(([k, v]) => k !== 'otherDeductionsReason' && v).map(([k, v]) => (
                                    <div key={k} className="flex justify-between text-app-text-muted">
                                      <span className="capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                                      <span className="text-app-text font-medium">{rupees(v)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {slip.attendanceSummary && (
                              <div className="sm:col-span-2 text-app-text-muted">
                                {slip.attendanceSummary.totalDaysInMonth} days · {slip.attendanceSummary.presentDays} present · {slip.attendanceSummary.paidLeaveDays} paid leave · {slip.attendanceSummary.lopDays} LOP
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {payslips.length === 0 && (
                <tr><td colSpan="6" className="text-center py-6 text-app-text-muted">No payslips issued yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
