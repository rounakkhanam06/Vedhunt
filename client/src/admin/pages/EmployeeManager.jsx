import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Eye, Shield, Award, AlertCircle, CheckCircle, Search, IndianRupee, Copy, Check, ExternalLink, Info, Edit2, Lock, Key, Power } from 'lucide-react';

// ─── Validation Rules ────────────────────────────────────────────────────────
const NAME_REGEX = /^[a-zA-Z\s'-]{2,50}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-\s()]{10,15}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^[2-9]{1}[0-9]{11}$/;

function validateField(name, value) {
  switch (name) {
    case 'firstName':
    case 'lastName':
      if (!value.trim()) return 'This field is required.';
      if (!NAME_REGEX.test(value.trim())) return 'Only letters, spaces, hyphens allowed (2–50 chars).';
      return '';
    case 'email':
      if (!value.trim()) return 'Email is required.';
      if (!EMAIL_REGEX.test(value.trim())) return 'Enter a valid email address.';
      return '';
    case 'phone':
      if (!value.trim()) return 'Phone number is required.';
      if (!PHONE_REGEX.test(value.trim())) return 'Enter a valid phone number.';
      return '';
    case 'roleId':
      if (!value) return 'Role is required.';
      return '';
    case 'joinDate':
      if (!value) return 'Joining date is required.';
      return '';
    case 'salaryCTC':
      if (!value) return 'Salary CTC is required.';
      if (isNaN(value) || Number(value) <= 0) return 'Enter a valid positive salary amount.';
      if (Number(value) < 10000) return 'Minimum salary must be ₹10,000.';
      if (Number(value) > 100000000) return 'Salary seems too high. Please verify.';
      return '';
    case 'panNumber':
      if (!value.trim()) return 'PAN number is required.';
      if (!PAN_REGEX.test(value.trim().toUpperCase())) return 'Invalid PAN. Format: ABCDE1234F (5 letters, 4 digits, 1 letter).';
      return '';
    case 'aadhaarNumber':
      if (!value.trim()) return 'Aadhaar number is required.';
      if (!AADHAAR_REGEX.test(value.trim())) return 'Invalid Aadhaar. Must be 12 digits and not start with 0 or 1.';
      return '';
    default:
      return '';
  }
}

// ─── Field Component ─────────────────────────────────────────────────────────
const Field = ({ label, hint, error, touched, children }) => (
  <div>
    <label className="block text-xs font-medium text-app-text-muted mb-1">
      {label} <span className="text-orange-500">*</span>
    </label>
    {children}
    {touched && error ? (
      <p className="mt-1 flex items-center gap-1 text-[11px] text-rose-400">
        <AlertCircle size={11} className="flex-shrink-0" /> {error}
      </p>
    ) : touched && !error ? (
      <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
        <CheckCircle size={11} className="flex-shrink-0" /> Looks good
      </p>
    ) : hint ? (
      <p className="mt-1 text-[11px] text-app-text-muted">{hint}</p>
    ) : null}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const EmployeeManager = () => {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const initialForm = {
    firstName: '', lastName: '', email: '', phone: '', roleId: '',
    employmentType: 'Billable', joinDate: '', salaryCTC: '',
    panNumber: '', aadhaarNumber: '',
  };
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [roles, setRoles] = useState([]);
  const [changeRoleId, setChangeRoleId] = useState('');

  // Edit Employee State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(initialForm);
  const [editErrors, setEditErrors] = useState({});
  const [editTouched, setEditTouched] = useState({});
  const [isUpdatingEmp, setIsUpdatingEmp] = useState(false);

  // Quick Password Reset State
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Sub-action states
  const [goalText, setGoalText] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [newCL, setNewCL] = useState('');
  const [newSL, setNewSL] = useState('');
  const [newPL, setNewPL] = useState('');

  // Salary History
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionForm, setRevisionForm] = useState({ ctc: '', effectiveFrom: '', reason: '' });
  const [isSavingRevision, setIsSavingRevision] = useState(false);

  useEffect(() => { fetchEmployees(); fetchRoles(); }, []);

  useEffect(() => {
    if ((isModalOpen || isDetailOpen) && roles.length === 0) {
      fetchRoles();
    }
  }, [isModalOpen, isDetailOpen, roles.length]);

  useEffect(() => {
    if (selectedEmp) {
      setNewCL(selectedEmp.leaveBalances?.CL ?? 6);
      setNewSL(selectedEmp.leaveBalances?.SL ?? 6);
      setNewPL(selectedEmp.leaveBalances?.PL ?? 12);
      fetchSalaryHistory(selectedEmp._id);
      setShowRevisionForm(false);
      setChangeRoleId('');
    }
  }, [selectedEmp]);

  // Only employee-type roles (isEmployeeRole) belong in this picker — an
  // admin-side role like EDITOR or SUPER_ADMIN must never be assignable to
  // an HRMS employee. /employees/roles already filters server-side; /rbac/roles
  // (the RBAC-wide list, used as a fallback here since it needs a different
  // permission) does not, so it's filtered client-side too.
  const fetchRoles = async () => {
    try {
      const res = await api.get('/rbac/roles');
      if (res.data?.success && res.data?.roles) {
        setRoles(res.data.roles.filter(r => r.isEmployeeRole));
        return;
      }
    } catch {
      // Fallback in case of different permissions
    }

    try {
      const res = await api.get('/employees/roles');
      if (res.data?.success && res.data?.roles) {
        setRoles(res.data.roles.filter(r => r.isEmployeeRole));
      }
    } catch {
      toast.error('Failed to load roles.');
    }
  };

  const handleChangeRole = async () => {
    if (!changeRoleId || !selectedEmp) return;
    try {
      const res = await api.put(`/employees/${selectedEmp._id}`, { roleId: changeRoleId });
      if (res.data.success) {
        toast.success('Role updated.');
        const updatedRes = await api.get('/employees');
        const found = updatedRes.data.employees.find(e => e._id === selectedEmp._id);
        setSelectedEmp(found);
        setEmployees(updatedRes.data.employees);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role.');
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedEmp) return;
    const currentStatus = selectedEmp.adminId?.isActive ?? true;
    const newStatus = !currentStatus;
    const actionText = newStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionText} this employee account? ${!newStatus ? 'They will not be able to log in to the portal.' : ''}`)) {
      return;
    }
    setIsTogglingStatus(true);
    try {
      const res = await api.put(`/employees/${selectedEmp._id}`, { isActive: newStatus });
      if (res.data.success) {
        toast.success(`Employee account ${newStatus ? 'activated' : 'deactivated'}.`);
        setSelectedEmp(res.data.employee);
        fetchEmployees();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${actionText} employee.`);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newAdminPassword || newAdminPassword.trim().length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const res = await api.put(`/employees/${selectedEmp._id}`, { password: newAdminPassword.trim() });
      if (res.data.success) {
        toast.success('Password updated successfully!');
        setSelectedEmp(res.data.employee);
        setNewAdminPassword('');
        setShowPasswordReset(false);
        fetchEmployees();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!selectedEmp) return;
    // Map existing roleDept to roleId if available
    const matchedRole = roles.find(r => (r.label || r.name).toLowerCase() === String(selectedEmp.roleDept).toLowerCase());
    setEditForm({
      firstName: selectedEmp.firstName || '',
      lastName: selectedEmp.lastName || '',
      email: selectedEmp.email || '',
      phone: selectedEmp.phone || '',
      roleId: matchedRole ? matchedRole._id : '',
      employmentType: selectedEmp.employmentType || 'Billable',
      joinDate: selectedEmp.joinDate ? selectedEmp.joinDate.substring(0, 10) : '',
      salaryCTC: selectedEmp.salaryCTC || '',
      panNumber: selectedEmp.panNumber || '',
      aadhaarNumber: selectedEmp.aadhaarNumber || '',
    });
    setEditErrors({});
    setEditTouched({});
    setIsEditModalOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
    if (editTouched[name]) {
      setEditErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleEditBlur = (e) => {
    const { name, value } = e.target;
    setEditTouched(prev => ({ ...prev, [name]: true }));
    setEditErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    const fields = ['firstName', 'lastName', 'email', 'phone', 'joinDate', 'salaryCTC', 'panNumber', 'aadhaarNumber'];
    const newTouched = {};
    const newErrors = {};
    fields.forEach(f => {
      newTouched[f] = true;
      newErrors[f] = validateField(f, editForm[f]);
    });
    setEditTouched(newTouched);
    setEditErrors(newErrors);

    if (Object.values(newErrors).some(Boolean)) {
      toast.error('Please fix highlighted errors.');
      return;
    }

    setIsUpdatingEmp(true);
    try {
      const res = await api.put(`/employees/${selectedEmp._id}`, {
        ...editForm,
        salaryCTC: Number(editForm.salaryCTC),
        panNumber: editForm.panNumber.toUpperCase(),
      });
      if (res.data.success) {
        toast.success('Employee details updated successfully!');
        setSelectedEmp(res.data.employee);
        setIsEditModalOpen(false);
        fetchEmployees();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update employee details.');
    } finally {
      setIsUpdatingEmp(false);
    }
  };

  const fetchSalaryHistory = async (employeeId) => {
    try {
      const res = await api.get(`/payroll/salary-revisions/${employeeId}`);
      if (res.data.success) setSalaryHistory(res.data.revisions);
    } catch {
      setSalaryHistory([]);
    }
  };

  const handleAddRevision = async (e) => {
    e.preventDefault();
    if (!revisionForm.ctc || Number(revisionForm.ctc) <= 0) { toast.error('Enter a valid new CTC.'); return; }
    if (!revisionForm.effectiveFrom) { toast.error('Effective date is required.'); return; }
    if (!revisionForm.reason.trim()) { toast.error('Reason for revision is required.'); return; }

    setIsSavingRevision(true);
    try {
      const res = await api.post('/payroll/salary-revisions', {
        employeeId: selectedEmp._id,
        ctc: Number(revisionForm.ctc),
        effectiveFrom: revisionForm.effectiveFrom,
        reason: revisionForm.reason.trim()
      });
      if (res.data.success) {
        toast.success('Salary revision added.');
        setRevisionForm({ ctc: '', effectiveFrom: '', reason: '' });
        setShowRevisionForm(false);
        fetchSalaryHistory(selectedEmp._id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add salary revision.');
    } finally {
      setIsSavingRevision(false);
    }
  };

  // Pre-fill from Application Manager onboarding. The candidate arrives with
  // a free-text `roleDept` (the job posting's role title) — waits for the
  // role list to load, then maps it to the closest matching role by label so
  // it lands as a real roleId selection instead of free text.
  const location = useLocation();
  useEffect(() => {
    if (location.state?.onboardCandidate && roles.length > 0) {
      const { roleDept, ...candidate } = location.state.onboardCandidate;
      if (roleDept) {
        const match = roles.find(r => (r.label || r.name).toLowerCase() === String(roleDept).toLowerCase());
        candidate.roleId = match ? match._id : '';
      }
      setForm(prev => ({ ...prev, ...candidate }));

      // Auto validate pre-filled fields to show them as green if valid
      const newTouched = {};
      const newErrors = {};
      Object.keys(candidate).forEach(key => {
        if (candidate[key]) {
          newTouched[key] = true;
          newErrors[key] = validateField(key, candidate[key]);
        }
      });
      setTouched(newTouched);
      setErrors(newErrors);

      setIsModalOpen(true);

      // Clear the state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, roles]);

  // ── Scroll Lock ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = parseInt(document.body.style.top || '0', 10) * -1;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/employees');
      if (res.data.success) setEmployees(res.data.employees);
    } catch {
      toast.error('Failed to load employee list.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Per-field change with instant validation ──────────────────────────────
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    const upperVal = (name === 'panNumber') ? value.toUpperCase() : value;
    setForm(prev => ({ ...prev, [name]: upperVal }));
    if (touched[name]) {
      setErrors(prev => ({ ...prev, [name]: validateField(name, upperVal) }));
    }
  }, [touched]);

  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  }, []);

  // ── Validate full form on submit ──────────────────────────────────────────
  const validateAll = () => {
    const fields = ['firstName', 'lastName', 'email', 'phone', 'roleId', 'joinDate', 'salaryCTC', 'panNumber', 'aadhaarNumber'];
    const newErrors = {};
    const newTouched = {};
    fields.forEach(f => {
      newTouched[f] = true;
      newErrors[f] = validateField(f, form[f]);
    });
    setTouched(newTouched);
    setErrors(newErrors);
    return Object.values(newErrors).every(e => !e);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!validateAll()) {
      toast.error('Please fix all highlighted errors before submitting.', { duration: 4000 });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.post('/employees', {
        ...form,
        salaryCTC: Number(form.salaryCTC),
        panNumber: form.panNumber.toUpperCase(),
      });
      if (res.data.success) {
        toast.success(
          `✅ Employee created!\nID: ${res.data.employeeId}\nTemp Password: ${res.data.tempPassword}`,
          { duration: 10000 }
        );
        closeModal();
        fetchEmployees();
      }
    } catch (err) {
      const serverMsg = err.response?.data?.message || 'Error creating employee.';
      toast.error(serverMsg, { duration: 6000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openModal = () => {
    setForm(initialForm);
    setErrors({});
    setTouched({});
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Are you sure? This will also remove their user account.')) return;
    try {
      const res = await api.delete(`/employees/${id}`);
      if (res.data.success) {
        toast.success('Employee deleted.');
        if (selectedEmp?._id === id) setIsDetailOpen(false);
        fetchEmployees();
      }
    } catch {
      toast.error('Error deleting employee.');
    }
  };

  const handleAddSubItem = async (type) => {
    if (!selectedEmp) return;
    try {
      let payload = {};
      if (type === 'goal') {
        if (!goalText.trim()) { toast.error('Goal description is required.'); return; }
        if (!goalTargetDate) { toast.error('Goal target date is required.'); return; }
        payload.newGoal = { goal: goalText, targetDate: goalTargetDate, status: 'Pending' };
      } else if (type === 'leaveBalances') {
        const cl = Number(newCL);
        const sl = Number(newSL);
        const pl = Number(newPL);
        if (cl < 0 || isNaN(cl) || sl < 0 || isNaN(sl) || pl < 0 || isNaN(pl)) { toast.error('Enter valid non-negative leave balances.'); return; }
        payload.leaveBalances = { CL: cl, SL: sl, PL: pl };
      }
      const res = await api.put(`/employees/${selectedEmp._id}`, payload);
      if (res.data.success) {
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} added successfully!`);
        const updatedRes = await api.get('/employees');
        const found = updatedRes.data.employees.find(e => e._id === selectedEmp._id);
        setSelectedEmp(found);
        setEmployees(updatedRes.data.employees);
        setGoalText(''); setGoalTargetDate('');
      }
    } catch {
      toast.error('Failed to add details.');
    }
  };

  const inputClass = (name) => {
    const base = 'w-full text-sm rounded-lg border px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:ring-1 bg-form-input-bg transition-colors';
    if (touched[name] && errors[name]) return `${base} border-rose-500/60 focus:ring-rose-500`;
    if (touched[name] && !errors[name]) return `${base} border-emerald-500/50 focus:ring-emerald-500`;
    return `${base} border-app-border focus:ring-orange-500`;
  };

  const normalizeText = (text) => text?.toLowerCase().replace(/\s+/g, '') || '';
  const normalizedSearch = normalizeText(searchQuery);
  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.firstName}${emp.lastName}`;
    return normalizeText(fullName).includes(normalizedSearch);
  });

  return (
    <div className="space-y-6 text-app-text">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">HRMS Employee Directory</h1>
          <p className="text-app-text-muted text-sm mt-1">Module 15 · Create accounts, manage operations, vault documents, assign tasks.</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition-all shadow-lg hover:shadow-orange-500/20 active:scale-[0.98] cursor-pointer"
        >
          <Plus size={18} /> Add New Employee
        </button>
      </div>

      {/* Employee Portal Login Guidance Banner */}
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
            <Info size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-app-text flex items-center gap-2">
              Employee Login Portal
            </div>
            <p className="text-xs text-app-text-muted mt-1 leading-relaxed">
              Employees created on this page can log in to their Employee Portal using their registered email and password at:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="px-3 py-1 rounded-md bg-app-bg border border-app-border text-xs font-mono font-bold text-primary select-all">
                https://vedhunt.in/employee/login
              </code>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => {
              const url = 'https://vedhunt.in/employee/login';
              navigator.clipboard.writeText(url);
              setCopiedUrl(true);
              setTimeout(() => setCopiedUrl(false), 2000);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-app-border bg-app-card hover:border-primary/50 text-xs font-semibold text-app-text transition-all cursor-pointer shadow-sm"
            title="Copy employee login portal URL"
          >
            {copiedUrl ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-app-text-muted" />}
            <span>{copiedUrl ? 'Copied URL!' : 'Copy Portal URL'}</span>
          </button>
          <a
            href="https://vedhunt.in/employee/login"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all"
            title="Open Employee Login Portal"
          >
            <span>Open</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Filter / Search */}
      <div className="flex items-center gap-4 bg-app-card p-4 rounded-xl border border-app-border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
          <input
            type="text"
            placeholder="Search by employee name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-form-input-bg border border-app-border rounded-lg pl-10 pr-4 py-2 text-sm text-app-text placeholder-app-text-muted focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-20 bg-app-card rounded-xl border border-app-border">
          <p className="text-app-text-muted">No employees registered yet. Click <strong>Add New Employee</strong> to get started.</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-20 bg-app-card rounded-xl border border-app-border">
          <p className="text-app-text-muted">No matching employees found for "{searchQuery}".</p>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-6 items-start">
          <div className="flex-1 w-full min-w-0">
            <div className="bg-app-card rounded-xl border border-app-border overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-app-border bg-app-bg text-app-text-muted text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4 whitespace-nowrap">Employee / ID</th>
                    <th className="px-6 py-4 whitespace-nowrap">Role & Dept</th>
                    <th className="px-6 py-4 whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 whitespace-nowrap">Joined</th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border text-sm">
                  {filteredEmployees.map(emp => (
                    <tr key={emp._id} className="hover:bg-surface-variant transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-app-text">{emp.firstName} {emp.lastName}</div>
                        <div className="text-xs text-orange-500 font-mono mt-0.5">{emp.employeeId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-app-text">{emp.roleDept}</div>
                        <div className="text-xs text-app-text-muted">{emp.employmentType}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${emp.adminId?.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {emp.adminId?.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-app-text-muted whitespace-nowrap">{new Date(emp.joinDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => { setSelectedEmp(emp); setIsDetailOpen(true); }}
                          className="p-2 bg-surface-variant hover:bg-app-border rounded-lg text-app-text-muted hover:text-app-text transition-all cursor-pointer"
                          title="Manage"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp._id)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-rose-400 transition-all cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Panel */}
          {isDetailOpen && selectedEmp && (
            <div className="w-full xl:w-[420px] flex-shrink-0 bg-app-card p-6 rounded-xl border border-app-border space-y-6 overflow-y-auto max-h-[85vh] sticky top-6 shadow-xl">
              <div className="flex justify-between items-start border-b border-app-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{selectedEmp.firstName} {selectedEmp.lastName}</h2>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${selectedEmp.adminId?.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                      {selectedEmp.adminId?.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </div>
                  <div className="text-xs text-orange-500 font-mono mt-0.5">{selectedEmp.employeeId}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenEditModal}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-orange-600/15 text-orange-400 border border-orange-500/20 hover:bg-orange-600 hover:text-white transition-all cursor-pointer font-medium"
                    title="Edit Employee Details"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button onClick={() => setIsDetailOpen(false)} className="text-app-text-muted hover:text-app-text text-xs cursor-pointer p-1">Close ✕</button>
                </div>
              </div>

              {/* Account Security & Access Control */}
              <div className="bg-surface-variant/40 border border-app-border rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-app-text flex items-center gap-1.5">
                    <Power size={14} className={selectedEmp.adminId?.isActive ? 'text-emerald-400' : 'text-rose-400'} />
                    Login Access Status
                  </span>
                  <button
                    onClick={handleToggleStatus}
                    disabled={isTogglingStatus}
                    className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer border disabled:opacity-50 ${
                      selectedEmp.adminId?.isActive
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/25 hover:bg-rose-600 hover:text-white'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-600 hover:text-white'
                    }`}
                  >
                    {isTogglingStatus ? 'Updating...' : selectedEmp.adminId?.isActive ? 'Deactivate Access' : 'Activate Access'}
                  </button>
                </div>
                <p className="text-[11px] text-app-text-muted">
                  {selectedEmp.adminId?.isActive
                    ? 'Account is active. Deactivating will immediately revoke login access to the portal.'
                    : 'Account is deactivated. Employee cannot log in or perform any actions.'}
                </p>
              </div>

              <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-orange-500 font-bold text-sm">
                    <Shield size={16} /> Credentials & Vault
                  </div>
                  <button
                    onClick={() => setShowPasswordReset(v => !v)}
                    className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Key size={13} /> {showPasswordReset ? 'Cancel' : 'Change Password'}
                  </button>
                </div>

                {showPasswordReset ? (
                  <form onSubmit={handleResetPassword} className="space-y-2 bg-app-bg/60 p-3 rounded-lg border border-orange-500/20">
                    <label className="block text-[10px] font-semibold text-app-text-muted uppercase tracking-wider">New Password (min 6 chars) *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter new password"
                        value={newAdminPassword}
                        onChange={e => setNewAdminPassword(e.target.value)}
                        className="flex-1 text-xs rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isUpdatingPassword || !newAdminPassword || newAdminPassword.length < 6}
                        className="px-3 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isUpdatingPassword ? 'Saving...' : 'Set'}
                      </button>
                    </div>
                  </form>
                ) : null}

                <div className="text-xs space-y-1 text-app-text-muted font-mono">
                  {selectedEmp.tempPassword && (
                    <div className="mb-2 pb-2 border-b border-orange-500/10 flex items-center justify-between">
                      <div>
                        <span className="text-orange-400 font-semibold">Current Password:</span> {selectedEmp.tempPassword}
                      </div>
                    </div>
                  )}
                  <div>PAN: {selectedEmp.panNumber || 'N/A'}</div>
                  <div>Aadhaar: {selectedEmp.aadhaarNumber || 'N/A'}</div>
                </div>
              </div>

              <div className="text-xs space-y-2 border-b border-app-border pb-4 text-app-text-muted">
                <div className="flex justify-between"><span>CTC:</span><span className="font-bold text-app-text">₹{selectedEmp.salaryCTC?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Type:</span><span className="font-bold text-app-text">{selectedEmp.employmentType}</span></div>
                <div className="flex justify-between"><span>Email:</span><span className="font-bold text-app-text">{selectedEmp.email}</span></div>
                <div className="flex justify-between"><span>Phone:</span><span className="font-bold text-app-text">{selectedEmp.phone || 'N/A'}</span></div>
                <div className="flex justify-between"><span>Leaves Used:</span><span className="font-bold text-app-text">CL: {selectedEmp.leavesUsed?.CL || 0}, SL: {selectedEmp.leavesUsed?.SL || 0}, PL: {selectedEmp.leavesUsed?.PL || 0}</span></div>
                <div className="flex justify-between"><span>Role:</span><span className="font-bold text-app-text">{selectedEmp.roleDept}</span></div>
              </div>

              {/* Change Role — determines actual Employee Portal access
                  (sidebar tabs + APIs), not just a display label. */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-app-text-muted flex items-center gap-1.5"><Shield size={14} /> Role</h3>
                <div className="flex gap-2">
                  <select
                    className="flex-1 text-xs rounded-lg border border-app-border bg-form-input-bg px-2 py-2 text-app-text focus:outline-none"
                    value={changeRoleId}
                    onChange={e => setChangeRoleId(e.target.value)}
                  >
                    <option value="" className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">Change role...</option>
                    {roles.map(r => (
                      <option key={r._id} value={r._id} className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">{r.label || r.name.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleChangeRole}
                    disabled={!changeRoleId}
                    className="px-4 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/20 text-xs font-semibold hover:bg-orange-600 hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Update Leave Balance */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-app-text-muted flex items-center gap-1.5">Update Leave Balances</h3>
                <div className="flex gap-2">
                  <input type="number" placeholder="CL" title="Casual Leave" className="w-16 text-xs rounded-lg border border-app-border bg-form-input-bg px-2 py-2 text-app-text placeholder-app-text-muted focus:outline-none" value={newCL} onChange={e => setNewCL(e.target.value)} />
                  <input type="number" placeholder="SL" title="Sick Leave" className="w-16 text-xs rounded-lg border border-app-border bg-form-input-bg px-2 py-2 text-app-text placeholder-app-text-muted focus:outline-none" value={newSL} onChange={e => setNewSL(e.target.value)} />
                  <input type="number" placeholder="PL" title="Paid Leave" className="w-16 text-xs rounded-lg border border-app-border bg-form-input-bg px-2 py-2 text-app-text placeholder-app-text-muted focus:outline-none" value={newPL} onChange={e => setNewPL(e.target.value)} />
                  <button onClick={() => handleAddSubItem('leaveBalances')} className="px-4 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/20 text-xs font-semibold hover:bg-orange-600 hover:text-white transition-all cursor-pointer">Update</button>
                </div>
              </div>

              {/* Add Goal */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-app-text-muted flex items-center gap-1.5"><Award size={14} /> Performance Goal</h3>
                <div>
                  <label className="block text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-1">Goal Description *</label>
                  <input type="text" placeholder="e.g. Increase sales by 10%" className="w-full text-xs rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text placeholder-app-text-muted focus:outline-none" value={goalText} onChange={e => setGoalText(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-1">Target Achievement Date *</label>
                  <input type="date" className="w-full text-xs rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text focus:outline-none" value={goalTargetDate} onChange={e => setGoalTargetDate(e.target.value)} />
                </div>
                <button onClick={() => handleAddSubItem('goal')} className="w-full mt-1 py-1.5 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/20 text-xs font-semibold hover:bg-orange-600 hover:text-white transition-all cursor-pointer">Assign Goal</button>
              </div>

              {/* Salary History — payroll itself (calculation/review/approval/
                  payslips) lives on the dedicated Payroll page; this is just
                  where a salary revision gets recorded. */}
              <div className="space-y-3 border-t border-app-border pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-app-text-muted flex items-center gap-1.5"><IndianRupee size={14} /> Salary History</h3>
                  <button
                    onClick={() => setShowRevisionForm((v) => !v)}
                    className="text-xs font-semibold text-orange-400 hover:text-orange-300 cursor-pointer"
                  >
                    {showRevisionForm ? 'Cancel' : '+ Add Revision'}
                  </button>
                </div>

                {showRevisionForm && (
                  <form onSubmit={handleAddRevision} className="space-y-2 bg-form-input-bg border border-app-border rounded-lg p-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-1">
                        Previous CTC (₹/year)
                      </label>
                      <div className="text-xs text-app-text py-2 px-3 bg-app-bg rounded-lg border border-app-border">
                        {salaryHistory[0] ? `₹${salaryHistory[0].ctc.toLocaleString()}` : 'No prior revision'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-1">New CTC (₹/year) *</label>
                      <input type="number" placeholder="e.g. 700000" className="w-full text-xs rounded-lg border border-app-border bg-app-bg px-3 py-2 text-app-text placeholder-app-text-muted focus:outline-none"
                        value={revisionForm.ctc} onChange={(e) => setRevisionForm((f) => ({ ...f, ctc: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-1">Effective Date *</label>
                      <input type="date" className="w-full text-xs rounded-lg border border-app-border bg-app-bg px-3 py-2 text-app-text focus:outline-none"
                        value={revisionForm.effectiveFrom} onChange={(e) => setRevisionForm((f) => ({ ...f, effectiveFrom: e.target.value }))} />
                      <p className="text-[10px] text-app-text-muted mt-1">If mid-month, payroll auto-prorates old vs. new salary for that month.</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-1">Reason for Revision *</label>
                      <input type="text" placeholder="e.g. Annual increment" className="w-full text-xs rounded-lg border border-app-border bg-app-bg px-3 py-2 text-app-text placeholder-app-text-muted focus:outline-none"
                        value={revisionForm.reason} onChange={(e) => setRevisionForm((f) => ({ ...f, reason: e.target.value }))} />
                    </div>
                    <button type="submit" disabled={isSavingRevision} className="w-full mt-1 py-1.5 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/20 text-xs font-semibold hover:bg-orange-600 hover:text-white transition-all cursor-pointer disabled:opacity-50">
                      {isSavingRevision ? 'Saving...' : 'Save Revision'}
                    </button>
                  </form>
                )}

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {salaryHistory.length === 0 ? (
                    <p className="text-xs text-app-text-muted">No salary revisions yet.</p>
                  ) : salaryHistory.map((rev) => (
                    <div key={rev._id} className="bg-form-input-bg p-3 rounded-lg border border-app-border text-xs">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-bold text-app-text">₹{rev.ctc.toLocaleString()}/yr</span>
                        {rev.status === 'Active' ? (
                          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-medium">Current</span>
                        ) : (
                          <span className="bg-surface-variant text-app-text-muted px-2 py-0.5 rounded font-medium">Superseded</span>
                        )}
                      </div>
                      {rev.previousCTC && <div className="text-app-text-muted">From ₹{rev.previousCTC.toLocaleString()}/yr</div>}
                      <div className="text-app-text-muted">
                        Effective {new Date(rev.effectiveFrom).toLocaleDateString('en-IN')}
                        {rev.effectiveTo ? ` – ${new Date(rev.effectiveTo).toLocaleDateString('en-IN')}` : ' onwards'}
                      </div>
                      <div className="text-app-text-muted italic mt-0.5">{rev.reason}</div>
                    </div>
                  ))}
                </div>

                <a href="/admin/payroll" className="text-xs font-semibold text-orange-400 hover:text-orange-300 inline-block mt-1">
                  View payslips & payroll →
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Add Employee Modal ─────────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-app-card border border-app-border rounded-2xl w-full max-w-lg shadow-2xl text-app-text flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-app-border bg-app-bg rounded-t-2xl flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-app-text">Add New Employee</h2>
                <p className="text-xs text-app-text-muted mt-0.5">Fill all fields carefully. PAN & Aadhaar will be encrypted.</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg text-app-text-muted hover:text-app-text hover:bg-surface-variant transition-all cursor-pointer text-lg leading-none">&times;</button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleAddEmployee} noValidate className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                {/* Employee Login Notice */}
                <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 flex items-start gap-2.5 text-xs text-app-text-muted">
                  <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <p>
                    Employees added here will log in at <strong className="text-primary font-mono select-all">https://vedhunt.in/employee/login</strong> using their registered email.
                  </p>
                </div>

                {/* Name Row */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" hint="As per official documents" error={errors.firstName} touched={touched.firstName}>
                    <input
                      name="firstName" type="text"
                      className={inputClass('firstName')}
                      placeholder="e.g. Rahul"
                      value={form.firstName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Field>
                  <Field label="Last Name" error={errors.lastName} touched={touched.lastName}>
                    <input
                      name="lastName" type="text"
                      className={inputClass('lastName')}
                      placeholder="e.g. Kumar"
                      value={form.lastName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Field>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Work / Personal Email" hint="Credentials will be sent here" error={errors.email} touched={touched.email}>
                    <input
                      name="email" type="email"
                      className={inputClass('email')}
                      placeholder="e.g. rahul@company.com"
                      value={form.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Field>
                  <Field label="Phone Number" error={errors.phone} touched={touched.phone}>
                    <input
                      name="phone" type="text"
                      className={inputClass('phone')}
                      placeholder="e.g. 9876543210"
                      value={form.phone}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Field>
                </div>

                {/* Role & Type */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Role" error={errors.roleId} touched={touched.roleId}>
                    <select
                      name="roleId"
                      className={inputClass('roleId')}
                      value={form.roleId}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    >
                      <option value="" className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">{roles.length === 0 ? 'Loading roles...' : 'Select a role...'}</option>
                      {roles.map(r => (
                        <option key={r._id} value={r._id} className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">{r.label || r.name.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </Field>
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-1">Employment Type <span className="text-orange-500">*</span></label>
                    <select
                      name="employmentType"
                      className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg p-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={form.employmentType}
                      onChange={handleChange}
                    >
                      <option value="Billable" className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">Billable</option>
                      <option value="Non-billable" className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">Non-billable</option>
                    </select>
                  </div>
                </div>

                {/* Join Date & CTC */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Joining Date" error={errors.joinDate} touched={touched.joinDate}>
                    <input
                      name="joinDate" type="date"
                      className={inputClass('joinDate')}
                      value={form.joinDate}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Field>
                  <Field label="Annual Salary CTC (₹)" hint="Gross annual package" error={errors.salaryCTC} touched={touched.salaryCTC}>
                    <input
                      name="salaryCTC" type="number"
                      className={inputClass('salaryCTC')}
                      placeholder="e.g. 600000"
                      value={form.salaryCTC}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Field>
                </div>

                {/* Secure Vault Section */}
                <div className="rounded-xl border border-orange-500/15 bg-orange-500/[0.04] p-4 space-y-4">
                  <div className="flex items-center gap-2 text-orange-400 text-xs font-semibold">
                    <Shield size={13} /> Secure Document Vault — encrypted before storage
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="PAN Number" hint="Format: ABCDE1234F" error={errors.panNumber} touched={touched.panNumber}>
                      <input
                        name="panNumber" type="text"
                        maxLength={10}
                        className={`${inputClass('panNumber')} font-mono tracking-widest uppercase`}
                        placeholder="ABCDE1234F"
                        value={form.panNumber}
                        onChange={handleChange}
                        onBlur={handleBlur}
                      />
                    </Field>
                    <Field label="Aadhaar Number" hint="12-digit govt. ID" error={errors.aadhaarNumber} touched={touched.aadhaarNumber}>
                      <input
                        name="aadhaarNumber" type="text"
                        maxLength={12}
                        className={`${inputClass('aadhaarNumber')} font-mono tracking-widest`}
                        placeholder="XXXXXXXXXXXX"
                        value={form.aadhaarNumber}
                        onChange={handleChange}
                        onBlur={handleBlur}
                      />
                    </Field>
                  </div>
                </div>

                {/* Error Summary */}
                {Object.values(errors).some(Boolean) && Object.values(touched).some(Boolean) && (
                  <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/5 border border-rose-500/15 rounded-lg px-4 py-3">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>Please fix all highlighted errors to continue.</span>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-app-border bg-app-bg rounded-b-2xl flex-shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-app-border text-app-text-muted hover:bg-surface-variant hover:text-app-text transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-all cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </span>
                  ) : 'Create & Send Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ─── Edit Employee Modal ─────────────────────────────────────────────── */}
      {isEditModalOpen && selectedEmp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setIsEditModalOpen(false); }}
        >
          <div className="bg-app-card border border-app-border rounded-2xl w-full max-w-lg shadow-2xl text-app-text flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-app-border bg-app-bg rounded-t-2xl flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-app-text">Edit Employee Details</h3>
                <p className="text-xs text-orange-500 font-mono mt-0.5">{selectedEmp.employeeId}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-app-text-muted hover:text-app-text text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="flex flex-col flex-1 overflow-hidden" noValidate>
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Name */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" error={editErrors.firstName} touched={editTouched.firstName}>
                    <input
                      name="firstName"
                      type="text"
                      className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg p-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={editForm.firstName}
                      onChange={handleEditChange}
                      onBlur={handleEditBlur}
                    />
                  </Field>
                  <Field label="Last Name" error={editErrors.lastName} touched={editTouched.lastName}>
                    <input
                      name="lastName"
                      type="text"
                      className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg p-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={editForm.lastName}
                      onChange={handleEditChange}
                      onBlur={handleEditBlur}
                    />
                  </Field>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Email Address" error={editErrors.email} touched={editTouched.email}>
                    <input
                      name="email"
                      type="email"
                      className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg p-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={editForm.email}
                      onChange={handleEditChange}
                      onBlur={handleEditBlur}
                    />
                  </Field>
                  <Field label="Phone Number" error={editErrors.phone} touched={editTouched.phone}>
                    <input
                      name="phone"
                      type="text"
                      className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg p-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={editForm.phone}
                      onChange={handleEditChange}
                      onBlur={handleEditBlur}
                    />
                  </Field>
                </div>

                {/* Role & Employment Type */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Role" error={editErrors.roleId} touched={editTouched.roleId}>
                    <select
                      name="roleId"
                      className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg p-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={editForm.roleId}
                      onChange={handleEditChange}
                      onBlur={handleEditBlur}
                    >
                      <option value="" className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">Select a role...</option>
                      {roles.map(r => (
                        <option key={r._id} value={r._id} className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">{r.label || r.name.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </Field>
                  <div>
                    <label className="block text-xs font-medium text-app-text-muted mb-1">Employment Type</label>
                    <select
                      name="employmentType"
                      className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg p-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={editForm.employmentType}
                      onChange={handleEditChange}
                    >
                      <option value="Billable" className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">Billable</option>
                      <option value="Non-billable" className="bg-white dark:bg-[#1a1f2b] text-gray-900 dark:text-white">Non-billable</option>
                    </select>
                  </div>
                </div>

                {/* Join Date & Salary CTC */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Joining Date" error={editErrors.joinDate} touched={editTouched.joinDate}>
                    <input
                      name="joinDate"
                      type="date"
                      className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg p-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={editForm.joinDate}
                      onChange={handleEditChange}
                      onBlur={handleEditBlur}
                    />
                  </Field>
                  <Field label="Annual Salary CTC (₹)" error={editErrors.salaryCTC} touched={editTouched.salaryCTC}>
                    <input
                      name="salaryCTC"
                      type="number"
                      className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg p-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={editForm.salaryCTC}
                      onChange={handleEditChange}
                      onBlur={handleEditBlur}
                    />
                  </Field>
                </div>

                {/* Vault: PAN & Aadhaar */}
                <div className="rounded-xl border border-orange-500/15 bg-orange-500/[0.04] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-orange-400 text-xs font-semibold">
                    <Shield size={13} /> Identity Documents (Encrypted)
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="PAN Number" error={editErrors.panNumber} touched={editTouched.panNumber}>
                      <input
                        name="panNumber"
                        type="text"
                        maxLength={10}
                        className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg p-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono tracking-widest uppercase"
                        value={editForm.panNumber}
                        onChange={handleEditChange}
                        onBlur={handleEditBlur}
                      />
                    </Field>
                    <Field label="Aadhaar Number" error={editErrors.aadhaarNumber} touched={editTouched.aadhaarNumber}>
                      <input
                        name="aadhaarNumber"
                        type="text"
                        maxLength={12}
                        className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg p-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono tracking-widest"
                        value={editForm.aadhaarNumber}
                        onChange={handleEditChange}
                        onBlur={handleEditBlur}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-app-border bg-app-bg rounded-b-2xl flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-app-border text-app-text-muted hover:bg-surface-variant hover:text-app-text transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingEmp}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-all cursor-pointer text-sm disabled:opacity-60"
                >
                  {isUpdatingEmp ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManager;
