import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, ShieldCheck, ChevronRight, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import LegalDocumentModal from '../../components/legal/LegalDocumentModal';
import ChangePasswordCard from '../components/ChangePasswordCard';
import { essPut, essKeys, apiError, useAccess, useEssLeave, useEssProjects } from '../lib/ess';
import { fmtDate } from '../lib/datetime';
import { WHATSAPP_APPS } from '../lib/whatsapp';
import employeeApi from '../../services/employeeApi';

const card = 'bg-app-card p-6 rounded-xl border border-app-border';
const Field = ({ label, children, mono }) => (
  <div>
    <div className="text-app-text-muted text-xs">{label}</div>
    <div className={`font-bold text-app-text mt-1 ${mono ? 'font-mono' : ''}`}>{children || '—'}</div>
  </div>
);
const Section = ({ title, children, className = '' }) => (
  <div className={`${card} space-y-5 ${className}`}>
    <h2 className="text-lg font-bold">{title}</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">{children}</div>
  </div>
);

const NAME_RE = /^[a-zA-Z\s]+$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function BankDetailsCard({ employee, onChanged }) {
  const bank = employee.bankDetails || {};
  const [form, setForm] = useState({ accountName: bank.accountName || '', bankName: bank.bankName || '', accountNumber: '', ifscCode: bank.ifscCode || '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const pending = employee.pendingBankChange;

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: key === 'ifscCode' ? e.target.value.toUpperCase() : e.target.value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!NAME_RE.test(form.accountName)) next.accountName = 'Must contain only letters and spaces.';
    if (!NAME_RE.test(form.bankName)) next.bankName = 'Must contain only letters and spaces.';
    if (!/^\d{9,18}$/.test(form.accountNumber.replace(/\s+/g, ''))) next.accountNumber = 'Account number must be 9–18 digits.';
    if (!IFSC_RE.test(form.ifscCode)) next.ifscCode = 'Invalid IFSC Code format. Expected e.g. HDFC0000123';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      const res = await essPut('/profile', { bankDetails: { ...form, accountNumber: form.accountNumber.replace(/\s+/g, '') } });
      toast.success(res.message || 'Bank change submitted for HR approval.');
      onChanged();
    } catch (err) {
      toast.error(apiError(err, 'Failed to submit bank change.'));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!window.confirm('Cancel your pending bank change request?')) return;
    try {
      const res = await essPut(`/bank-change-requests/${pending._id}/cancel`);
      toast.success(res.message || 'Request cancelled.');
      onChanged();
    } catch (err) {
      toast.error(apiError(err, 'Could not cancel the request.'));
    }
  };

  const input = (key, placeholder, extra = {}) => (
    <div>
      <input className={`w-full text-sm rounded-lg border ${errors[key] ? 'border-rose-500' : 'border-app-border'} bg-form-input-bg px-4 py-2 text-app-text`}
        placeholder={placeholder} value={form[key]} onChange={set(key)} {...extra} />
      {errors[key] && <p className="text-rose-500 text-xs mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className={`${card} space-y-4`}>
      <h2 className="text-lg font-bold">Payroll · Salary Account</h2>
      <div className="text-xs bg-form-input-bg border border-app-border rounded-lg p-3 space-y-1.5">
        <p className="font-bold uppercase tracking-wider text-app-text-muted mb-1">Salary account on file</p>
        {bank.accountNumber ? (
          <>
            <div className="flex justify-between gap-2"><span className="text-app-text-muted">Holder</span><span>{bank.accountName}</span></div>
            <div className="flex justify-between gap-2"><span className="text-app-text-muted">Bank</span><span>{bank.bankName}</span></div>
            <div className="flex justify-between gap-2"><span className="text-app-text-muted">Account</span><span className="font-mono">{bank.accountNumber}</span></div>
            <div className="flex justify-between gap-2"><span className="text-app-text-muted">IFSC</span><span className="font-mono">{bank.ifscCode}</span></div>
          </>
        ) : <p className="text-app-text-muted">No bank account added yet.</p>}
      </div>
      {pending ? (
        <div className="text-xs rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
          <p className="font-bold text-amber-500">Change waiting for HR approval</p>
          <p className="text-app-text">{pending.requested.bankName} · <span className="font-mono">{pending.requested.accountNumber}</span> · {pending.requested.ifscCode}</p>
          <p className="text-app-text-muted">Requested {new Date(pending.createdAt).toLocaleDateString()}. Salary keeps going to the account on file until it is approved.</p>
          <button type="button" onClick={cancel} className="text-rose-400 font-semibold hover:underline cursor-pointer">Cancel request</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-app-text-muted">Changes to your salary account need HR approval before they apply.</p>
          {input('accountName', 'Account holder name')}
          {input('bankName', 'Bank name')}
          {input('accountNumber', bank.accountNumber ? 'New account number' : 'Account number', { inputMode: 'numeric', autoComplete: 'off' })}
          {input('ifscCode', 'IFSC code (e.g. HDFC0000123)')}
          <button type="submit" disabled={submitting} className="w-full py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit for HR Approval'}
          </button>
        </form>
      )}
    </div>
  );
}

function PreferencesCard({ employee }) {
  const queryClient = useQueryClient();
  const current = employee.preferences?.whatsappApp || 'ask';
  const save = async (whatsappApp) => {
    try {
      await essPut('/preferences', { whatsappApp });
      queryClient.setQueryData(essKeys.profile, (p) => (p ? { ...p, preferences: { ...p.preferences, whatsappApp } } : p));
      toast.success('Preference saved');
    } catch (err) {
      toast.error(apiError(err, 'Could not save the preference.'));
    }
  };
  return (
    <div className={`${card} space-y-3`}>
      <h2 className="text-lg font-bold">Preferences</h2>
      <label className="block text-xs text-app-text-muted">Open WhatsApp chats with</label>
      <select value={current} onChange={(e) => save(e.target.value)} className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text">
        <option value="ask">Ask me every time</option>
        {WHATSAPP_APPS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
      </select>
    </div>
  );
}

/** Corporate employee profile. Sensitive identifiers arrive masked from the server. */
export default function ProfileTab({ employee }) {
  const queryClient = useQueryClient();
  const { segment, hasProjects } = useAccess();
  const { data: myProjects = [] } = useEssProjects(hasProjects);
  const [legalDoc, setLegalDoc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { data: leave } = useEssLeave();
  const { data: perf } = useQuery({ queryKey: ['ess', 'active-cycle'], queryFn: () => employeeApi.get('/performance/active-cycle').then((r) => r.data.cycle) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: essKeys.profile });

  const onProbation = employee.employmentStatus === 'Probation' && employee.probation?.isApplicable;
  const monthAttendance = (employee.attendance || []).filter((a) => {
    const d = new Date(a.date); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const leaveTypes = onProbation ? ['EL'] : ['CL', 'SL', 'PL'];
  const balances = leave?.leaveBalances || employee.leaveBalances || {};
  const used = leave?.leavesUsed || employee.leavesUsed || {};
  // Active project assignments (PM / team), plus projects named on open tasks
  const projects = [...new Set([
    ...myProjects.filter((p) => !['Completed', 'Cancelled'].includes(p.status))
      .map((p) => `${p.projectName}${p.client_ref?.businessName ? ` (${p.client_ref.businessName})` : ''}${p.myRole === 'Project Manager' ? ' · PM' : ''}`),
    ...(employee.tasks || []).filter((t) => !['Completed', 'Cancelled'].includes(t.status)).flatMap((t) => [t.project, t.client]).filter(Boolean),
  ])];

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('photo', file);
    setUploading(true);
    try {
      await essPut('/profile/photo', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Profile photo updated');
      refresh();
    } catch (err) {
      toast.error(apiError(err, 'Could not upload the photo.'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className={`${card} flex flex-col sm:flex-row gap-5 items-start sm:items-center`}>
          <label className="relative w-20 h-20 shrink-0 cursor-pointer group" title="Change photo">
            {employee.profilePhoto
              ? <img src={employee.profilePhoto} alt="" className="w-20 h-20 rounded-full object-cover border border-app-border" />
              : <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl border border-primary/15">{employee.firstName.charAt(0)}{employee.lastName.charAt(0)}</div>}
            <span className="absolute inset-0 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? '…' : <Camera size={18} />}
            </span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadPhoto} disabled={uploading} />
          </label>
          <div>
            <h2 className="text-xl font-bold">{employee.firstName} {employee.lastName}</h2>
            <p className="text-sm text-app-text-muted">{employee.designation || employee.roleDept}{employee.department ? ` · ${employee.department}` : ''}</p>
            <p className="text-xs font-mono text-primary mt-1">{employee.employeeId}</p>
          </div>
        </div>

        <Section title="Identity">
          <Field label="Employee ID" mono>{employee.employeeId}</Field>
          <Field label="Full Name">{employee.firstName} {employee.lastName}</Field>
          <Field label="Official Email">{employee.email}</Field>
          <Field label="Phone">{employee.phone}</Field>
          <Field label="Date of Birth">{employee.dateOfBirth && fmtDate(employee.dateOfBirth)}</Field>
          <Field label="PAN" mono>{employee.panNumber}</Field>
          <Field label="Aadhaar" mono>{employee.aadhaarNumber}</Field>
        </Section>

        <Section title="Employment">
          <Field label="Department / Segment">{[employee.department, segment !== 'General' && segment].filter(Boolean).join(' · ') || employee.roleDept}</Field>
          <Field label="Role">{employee.roleDept}</Field>
          <Field label="Designation">{employee.designation}</Field>
          <Field label="Reporting Manager">{employee.reportingManager && `${employee.reportingManager.firstName} ${employee.reportingManager.lastName}`}</Field>
          <Field label="Joining Date">{fmtDate(employee.joinDate)}</Field>
          <Field label="Employment Type">{employee.employmentType}</Field>
          <Field label="Work Location">{employee.workLocation}</Field>
          <Field label="Status">{onProbation ? `On Probation (until ${fmtDate(employee.probation?.endDate)})` : employee.employmentStatus || 'Permanent'}</Field>
        </Section>

        <Section title="Work">
          <Field label="Primary Responsibilities"><span className="font-normal whitespace-pre-wrap">{employee.responsibilities}</span></Field>
          <Field label="Assigned Projects / Clients">{projects.join(', ')}</Field>
          <Field label="Skills / Certifications">{employee.skills?.join(', ')}</Field>
          <Field label="Current Performance Cycle">{perf?.title || 'No active cycle'}</Field>
        </Section>

        <Section title="HR">
          <Field label="Leave Balance (available / allowed)">
            {leaveTypes.map((t) => `${t} ${Math.max(0, (balances[t] || 0) - (used[t] || 0))}/${balances[t] || 0}`).join(' · ')}
          </Field>
          <Field label="Attendance This Month">
            {monthAttendance.filter((a) => a.status === 'Present').length} present · {monthAttendance.filter((a) => a.lateByMins > 0).length} late · {monthAttendance.filter((a) => a.missedClockOut && !a.clockOut).length} missing clock-out
          </Field>
        </Section>

        <div className={card}>
          <h3 className="text-sm font-bold mb-1">Legal</h3>
          <p className="text-xs text-app-text-muted mb-4">The terms and privacy policy that apply to your use of the Employee Portal.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[{ doc: 'employee-terms', label: 'Terms & Conditions', icon: FileText }, { doc: 'employee-privacy', label: 'Privacy Policy', icon: ShieldCheck }].map(({ doc, label, icon: Icon }) => (
              <button key={doc} type="button" onClick={() => setLegalDoc(doc)}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-form-input-bg border border-app-border text-left hover:border-primary/40 transition-all cursor-pointer">
                <span className="flex items-center gap-2.5 text-sm text-app-text"><Icon size={16} className="text-primary" /> {label}</span>
                <ChevronRight size={16} className="text-app-text-muted" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <BankDetailsCard key={employee.pendingBankChange?._id || 'none'} employee={employee} onChanged={refresh} />
        <ChangePasswordCard />
        <PreferencesCard employee={employee} />
      </div>
      {legalDoc && <LegalDocumentModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </div>
  );
}
