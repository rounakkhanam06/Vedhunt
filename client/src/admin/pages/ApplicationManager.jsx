import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Loader, Users, Download, ExternalLink, Eye, EyeOff, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ApplicationManager() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingCandidate, setOnboardingCandidate] = useState(null);
  const [showSalary, setShowSalary] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    role: '',
    employmentType: 'Billable',
    joiningDate: '',
    salaryCTC: ''
  });

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/applications');
      setApplications(res.data || []);
    } catch (error) {
      alert('Failed to load applications');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (app, newStatus) => {
    if (newStatus === 'Selected / Hired') {
      setOnboardingCandidate(app);
      setOnboardingData({
        role: app.jobId ? app.jobId.department : '',
        employmentType: 'Billable',
        joiningDate: '',
        salaryCTC: app.expectedCTC || ''
      });
      return;
    }

    try {
      await api.patch(`/applications/${app._id}/status`, { status: newStatus });
      toast.success('Status updated successfully');
      setApplications(prev => prev.map(a => a._id === app._id ? { ...a, status: newStatus } : a));
    } catch (error) {
      toast.error('Failed to update status');
      console.error(error);
    }
  };

  const handleOnboardConfirm = async () => {
    try {
      // Actually save the status in backend
      await api.patch(`/applications/${onboardingCandidate._id}/status`, { status: 'Selected / Hired' });
      
      toast.success('Application marked as Selected! Redirecting to Employee Manager...');
      
      // Clear from list
      setApplications(prev => prev.filter(a => a._id !== onboardingCandidate._id));
      
      const candidateData = {
        firstName: onboardingCandidate.fullName?.split(' ')[0] || '',
        lastName: onboardingCandidate.fullName?.split(' ').slice(1).join(' ') || '',
        email: onboardingCandidate.email || '',
        phone: onboardingCandidate.phone || '',
        roleDept: onboardingData.role || '',
        employmentType: onboardingData.employmentType || 'Billable',
        joinDate: onboardingData.joiningDate || '',
        salaryCTC: onboardingData.salaryCTC || ''
      };

      setOnboardingCandidate(null);

      // Navigate to employees page with pre-filled candidate data
      navigate('/admin/employees', { state: { onboardCandidate: candidateData } });
    } catch (error) {
      toast.error('Failed to update application status');
      console.error(error);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleExport = (type) => {
    if (!applications.length) return;

    const headers = ['Name', 'Email', 'Phone', 'Job Role', 'Department', 'Experience', 'Current CTC', 'Expected CTC', 'Notice Period', 'Applied On', 'Resume URL', 'LinkedIn URL', 'Portfolio URL'];
    
    if (type === 'csv') {
      const csvData = applications.map(app => {
        return [
          `"${app.fullName || ''}"`,
          `"${app.email || ''}"`,
          `"${app.phone || ''}"`,
          `"${app.jobId ? app.jobId.title : 'General Application'}"`,
          `"${app.jobId ? app.jobId.department : ''}"`,
          `"${app.experienceYears || ''}"`,
          `"${app.currentCTC || ''}"`,
          `"${app.expectedCTC || ''}"`,
          `"${app.noticePeriod || ''}"`,
          `"${formatDate(app.createdAt)}"`,
          `"${app.resumeUrl || ''}"`,
          `"${app.linkedinUrl || ''}"`,
          `"${app.portfolioUrl || ''}"`
        ].join(',');
      });

      const csvContent = [headers.join(','), ...csvData].join('\n');
      downloadFile(csvContent, 'text/csv;charset=utf-8;', `applications_${new Date().toISOString().split('T')[0]}.csv`);
    } else if (type === 'excel') {
      let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Applications</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table><thead><tr>';
      headers.forEach(h => html += `<th>${h}</th>`);
      html += '</tr></thead><tbody>';
      applications.forEach(app => {
        html += '<tr>';
        html += `<td>${app.fullName || ''}</td>`;
        html += `<td>${app.email || ''}</td>`;
        html += `<td>${app.phone || ''}</td>`;
        html += `<td>${app.jobId ? app.jobId.title : 'General Application'}</td>`;
        html += `<td>${app.jobId ? app.jobId.department : ''}</td>`;
        html += `<td>${app.experienceYears || ''}</td>`;
        html += `<td>${app.currentCTC || ''}</td>`;
        html += `<td>${app.expectedCTC || ''}</td>`;
        html += `<td>${app.noticePeriod || ''}</td>`;
        html += `<td>${formatDate(app.createdAt)}</td>`;
        html += `<td>${app.resumeUrl || ''}</td>`;
        html += `<td>${app.linkedinUrl || ''}</td>`;
        html += `<td>${app.portfolioUrl || ''}</td>`;
        html += '</tr>';
      });
      html += '</tbody></table></body></html>';
      downloadFile(html, 'application/vnd.ms-excel', `applications_${new Date().toISOString().split('T')[0]}.xls`);
    }
  };

  const downloadFile = (content, mimeType, filename) => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between border-b border-app-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Application Manager</h1>
          <p className="text-app-text-muted text-sm mt-1">Review candidate applications submitted from the career page.</p>
        </div>
        <div className="relative group">
          <button
            disabled={applications.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-semibold text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          {applications.length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-app-card border border-app-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <button
                onClick={() => handleExport('csv')}
                className="w-full text-left px-4 py-3 text-sm text-app-text hover:bg-app-bg transition-colors flex items-center gap-2 cursor-pointer"
              >
                Download in CSV
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="w-full text-left px-4 py-3 text-sm text-app-text hover:bg-app-bg transition-colors flex items-center gap-2 border-t border-app-border cursor-pointer"
              >
                Download in Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="text-center text-app-text-muted py-12 bg-app-card rounded-xl border border-app-border shadow-sm">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-primary" />
          <p className="text-sm">No applications found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-app-card border border-app-border rounded-xl shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-app-border bg-app-bg/50">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-app-text">Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-app-text">Email</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-app-text">Phone</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-app-text">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-app-text">Job Role</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-app-text">Experience</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-app-text">CTC Details</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-app-text">Notice Period</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-app-text">Application Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-app-text">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {applications.map((app) => (
                <tr key={app._id} className="hover:bg-app-bg/60 transition-colors">
                  <td className="px-6 py-4 text-sm text-app-text font-medium whitespace-nowrap">
                    {app.fullName}
                  </td>
                  <td className="px-6 py-4 text-sm text-app-text-muted whitespace-nowrap">
                    {app.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-app-text-muted whitespace-nowrap">
                    {app.phone}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={app.status || 'Pending'}
                      onChange={(e) => handleStatusChange(app, e.target.value)}
                      className="bg-app-bg text-xs font-semibold text-app-text border border-app-border rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Interviewing">Interviewing</option>
                      <option value="Selected / Hired">Selected / Hired</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                      {app.jobId ? app.jobId.title : 'General Application'}
                    </span>
                    {app.jobId && <div className="text-xs text-app-text-muted mt-1 whitespace-nowrap">{app.jobId.department}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-app-text whitespace-nowrap">
                    {app.experienceYears}
                  </td>
                  <td className="px-6 py-4 text-xs text-app-text whitespace-nowrap">
                    <div><span className="text-app-text-muted">Cur:</span> {app.currentCTC || 'N/A'}</div>
                    <div><span className="text-app-text-muted">Exp:</span> {app.expectedCTC || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-app-text whitespace-nowrap">
                    {app.noticePeriod || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-app-text-muted whitespace-nowrap">
                    {formatDate(app.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      {app.resumeUrl && (
                        <a 
                          href={app.resumeUrl?.startsWith('http') ? app.resumeUrl : (process.env.NODE_ENV === 'production' ? app.resumeUrl : `http://localhost:5000${app.resumeUrl}`)}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 hover:underline"
                        >
                          <Download size={13} /> Resume
                        </a>
                      )}
                      {app.linkedinUrl && (
                        <a 
                          href={app.linkedinUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 hover:underline"
                        >
                          <ExternalLink size={13} /> LinkedIn
                        </a>
                      )}
                      {app.portfolioUrl && (
                        <a 
                          href={app.portfolioUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 hover:underline"
                        >
                          <ExternalLink size={13} /> Portfolio
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

      {/* Onboarding Modal */}
      {onboardingCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-app-card rounded-xl border border-app-border w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-app-border bg-app-bg/50">
              <h2 className="text-xl font-bold text-app-text">Onboard Employee - {onboardingCandidate.fullName}</h2>
              <button 
                onClick={() => setOnboardingCandidate(null)}
                className="text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Read-only fields */}
              <div className="grid grid-cols-2 gap-4 opacity-80">
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">First Name</label>
                  <input type="text" readOnly value={onboardingCandidate.fullName.split(' ')[0]} className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text cursor-not-allowed text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Email</label>
                  <input type="text" readOnly value={onboardingCandidate.email} className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text cursor-not-allowed text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Phone Number</label>
                  <input type="text" readOnly value={onboardingCandidate.phone} className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text cursor-not-allowed text-sm" />
                </div>
              </div>

              <hr className="border-app-border" />

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Role / Department</label>
                  <input 
                    type="text" 
                    value={onboardingData.role || ''}
                    onChange={(e) => setOnboardingData({...onboardingData, role: e.target.value})}
                    className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all" 
                    placeholder="e.g. Engineering"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Employment Type</label>
                  <select 
                    value={onboardingData.employmentType}
                    onChange={(e) => setOnboardingData({...onboardingData, employmentType: e.target.value})}
                    className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all"
                  >
                    <option value="Billable">Billable</option>
                    <option value="Non-billable">Non-billable</option>
                    <option value="Partner">Partner</option>
                    <option value="Founder">Founder</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Joining Date</label>
                  <input 
                    type="date" 
                    value={onboardingData.joiningDate}
                    onChange={(e) => setOnboardingData({...onboardingData, joiningDate: e.target.value})}
                    className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-app-text-muted mb-1">Salary CTC (INR)</label>
                  <div className="relative">
                    <input 
                      type={showSalary ? "text" : "password"} 
                      value={onboardingData.salaryCTC || ''}
                      onChange={(e) => setOnboardingData({...onboardingData, salaryCTC: e.target.value})}
                      className="w-full bg-app-bg border border-app-border rounded-lg pl-4 pr-10 py-2 text-app-text focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all" 
                      placeholder="e.g. 1200000"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowSalary(!showSalary)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text cursor-pointer"
                    >
                      {showSalary ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-app-border bg-app-bg/50">
              <button 
                onClick={() => setOnboardingCandidate(null)}
                className="px-4 py-2 text-sm font-medium text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleOnboardConfirm}
                disabled={!onboardingData.role || !onboardingData.joiningDate || !onboardingData.salaryCTC}
                className="px-6 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
              >
                Confirm Onboard & Register
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
