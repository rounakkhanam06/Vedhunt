import { useState, useEffect } from 'react';
import { User, Plug, BarChart2, Database, Save, Mail, Lock, Smartphone, DownloadCloud, AlertCircle, Phone, MapPin, Share2, Clock, CreditCard, QrCode, UploadCloud, LifeBuoy } from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';
import { settingsService } from '../../services/settingsService';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';

const SettingsPage = () => {
  const { admin } = useAdminStore();
  const { can } = usePermissions();
  const [activeTab, setActiveTab] = useState('contact');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [contactData, setContactData] = useState({
    phone: '',
    phoneDisplay: '',
    email: '',
    whatsappNumber: '',
    whatsappMessage: '',
    hours: '',
    address: '',
    cin: '',
    registration: '',
    copyright: '',
    socialLinks: []
  });

  const defaultCampaignData = {
    facebookPixel: { id: '', enabled: false },
    googleAnalytics: { id: '', enabled: false },
    googleTagManager: { id: '', enabled: false },
    googleAds: { id: '', enabled: false, conversionLabel: '' },
    linkedInInsight: { id: '', enabled: false },
    audit: { updatedBy: '', updatedAt: '' }
  };
  const [campaignData, setCampaignData] = useState(defaultCampaignData);
  const [campaignErrors, setCampaignErrors] = useState({});

  const [emailSettings, setEmailSettings] = useState({
    emailFrom: '',
    hrEmail: ''
  });

  const [officeTimings, setOfficeTimings] = useState({
    standardStartTime: '09:00',
    standardEndTime: '18:00'
  });

  const [attendanceRules, setAttendanceRules] = useState({
    halfDayCheckInLimit: '13:00',
    halfDayHoursThreshold: 4.5,
    defaultLeaves: { CL: 6, SL: 6, PL: 12 }
  });

  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', type: 'Public' });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [paymentSettings, setPaymentSettings] = useState({
    upiId: '',
    upiQrCodeUrl: '',
    bankDetails: {
      accountName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
    },
  });

  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [assignmentRules, setAssignmentRules] = useState([]);
  const [bdRoster, setBdRoster] = useState([]);
  const emptyRuleForm = { name: '', matchService: '', matchSource: '', bdPool: [], maxActiveLeads: '', priority: 0 };
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [editingRuleId, setEditingRuleId] = useState(null);

  const fetchContactData = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getContactInfo();
      if (res.data) {
        setContactData((prev) => ({
          ...prev,
          ...res.data,
          socialLinks: Array.isArray(res.data.socialLinks) ? res.data.socialLinks : []
        }));
      }
    } catch (error) {
      toast.error('Failed to load contact info');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignData = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getCampaignSettings();
      if (res.data) {
        setCampaignData(res.data);
      }
    } catch (error) {
      toast.error('Failed to load campaign settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getEmailSettings();
      if (res.data) {
        setEmailSettings(res.data);
      }
    } catch (error) {
      toast.error('Failed to load email settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficeTimings = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getOfficeTimings();
      if (res.data) {
        setOfficeTimings(res.data);
      }
    } catch (error) {
      toast.error('Failed to load office timings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceRules = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getAttendanceRules();
      if (res.data) {
        setAttendanceRules(res.data);
      }
    } catch (error) {
      toast.error('Failed to load attendance rules');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/employees/holidays?year=${selectedYear}`);
      if (res.data.success) {
        setHolidays(res.data.holidays);
      }
    } catch (error) {
      toast.error('Failed to load holidays');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings/payment');
      if (res.data) {
        setPaymentSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (_) {
      // Not yet saved — use defaults silently
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentSettings = async () => {
    try {
      const res = await api.get('/admin/assignment/settings');
      if (res.data.success) setAutoAssignEnabled(!!res.data.data.autoAssignEnabled);
    } catch (error) {
      toast.error('Failed to load assignment settings');
      console.error(error);
    }
  };

  const fetchAssignmentRules = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/assignment/rules');
      if (res.data.success) setAssignmentRules(res.data.data);
    } catch (error) {
      toast.error('Failed to load assignment rules');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBdRoster = async () => {
    try {
      const res = await api.get('/admin/assignment/bds');
      if (res.data.success) setBdRoster(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleAutoAssign = async () => {
    const next = !autoAssignEnabled;
    try {
      await api.put('/admin/assignment/settings', { autoAssignEnabled: next });
      setAutoAssignEnabled(next);
      toast.success(next ? 'Automated round-robin enabled' : 'Automated round-robin disabled');
    } catch (error) {
      toast.error('Failed to update assignment settings');
    }
  };

  const toggleBdInPool = (bdId) => {
    setRuleForm((prev) => ({
      ...prev,
      bdPool: prev.bdPool.includes(bdId) ? prev.bdPool.filter((id) => id !== bdId) : [...prev.bdPool, bdId]
    }));
  };

  const handleEditRule = (rule) => {
    setEditingRuleId(rule._id);
    setRuleForm({
      name: rule.name,
      matchService: rule.matchService || '',
      matchSource: rule.matchSource || '',
      bdPool: (rule.bdPool || []).map((bd) => bd._id),
      maxActiveLeads: rule.maxActiveLeads ?? '',
      priority: rule.priority || 0
    });
  };

  const handleSubmitRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.name.trim()) return toast.error('Please name this rule');
    try {
      setSaving(true);
      if (editingRuleId) {
        await api.put(`/admin/assignment/rules/${editingRuleId}`, ruleForm);
        toast.success('Rule updated');
      } else {
        await api.post('/admin/assignment/rules', ruleForm);
        toast.success('Rule created');
      }
      setRuleForm(emptyRuleForm);
      setEditingRuleId(null);
      fetchAssignmentRules();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRuleActive = async (rule) => {
    try {
      await api.put(`/admin/assignment/rules/${rule._id}`, { active: !rule.active });
      fetchAssignmentRules();
    } catch (error) {
      toast.error('Failed to update rule');
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Delete this assignment rule?')) return;
    try {
      await api.delete(`/admin/assignment/rules/${id}`);
      toast.success('Rule deleted');
      fetchAssignmentRules();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const handleSavePaymentSettings = async () => {
    setSaving(true);
    try {
      await api.put('/admin/settings/payment', paymentSettings);
      toast.success('Payment settings saved!');
    } catch (err) {
      toast.error('Failed to save payment settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const [uploadingQr, setUploadingQr] = useState(false);

  const handleQrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      return toast.error('File size must be less than 5MB');
    }
    try {
      setUploadingQr(true);
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/upload/public', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setPaymentSettings(p => ({ ...p, upiQrCodeUrl: res.data.url }));
        toast.success('QR Code uploaded successfully');
      }
    } catch (error) {
      toast.error('Failed to upload QR Code');
    } finally {
      setUploadingQr(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'contact') fetchContactData();
    if (activeTab === 'campaigns') fetchCampaignData();
    if (activeTab === 'integrations') fetchEmailSettings();
    if (activeTab === 'officeTimings') fetchOfficeTimings();
    if (activeTab === 'attendanceRules') fetchAttendanceRules();
    if (activeTab === 'holidays') fetchHolidays();
    if (activeTab === 'payment') fetchPaymentSettings();
    if (activeTab === 'assignmentRules') {
      fetchAssignmentSettings();
      fetchAssignmentRules();
      fetchBdRoster();
    }
  }, [activeTab, selectedYear]);

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSocialLinkChange = (index, field, value) => {
    setContactData((prev) => {
      const newLinks = [...prev.socialLinks];
      newLinks[index] = { ...newLinks[index], [field]: value };
      return { ...prev, socialLinks: newLinks };
    });
  };

  const addSocialLink = () => {
    setContactData((prev) => ({
      ...prev,
      socialLinks: [
        ...prev.socialLinks,
        { id: Date.now().toString(), platform: '', url: '' }
      ]
    }));
  };

  const removeSocialLink = (index) => {
    if (!window.confirm('Are you sure you want to remove this social link?')) return;
    setContactData((prev) => {
      const newLinks = [...prev.socialLinks];
      newLinks.splice(index, 1);
      return { ...prev, socialLinks: newLinks };
    });
    toast.success('Removed from list. Please click "Save Changes" below to apply.');
  };

  const handleSaveContact = async () => {
    try {
      setSaving(true);
      await settingsService.updateContactInfo(contactData);
      toast.success('Contact info saved successfully!');
    } catch (error) {
      toast.error('Failed to save contact info');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleEmailSettingsChange = (e) => {
    const { name, value } = e.target;
    setEmailSettings((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveIntegrations = async () => {
    try {
      setSaving(true);
      await settingsService.updateEmailSettings(emailSettings);
      toast.success('Email settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save email settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleOfficeTimingsChange = (e) => {
    const { name, value } = e.target;
    setOfficeTimings((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveOfficeTimings = async () => {
    try {
      setSaving(true);
      await settingsService.updateOfficeTimings(officeTimings);
      toast.success('Office timings saved successfully!');
    } catch (error) {
      toast.error('Failed to save office timings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleAttendanceRulesChange = (e, isNested = false, nestedKey = '') => {
    const { name, value } = e.target;
    if (isNested) {
      setAttendanceRules(prev => ({
        ...prev,
        [nestedKey]: { ...prev[nestedKey], [name]: Number(value) }
      }));
    } else {
      setAttendanceRules(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSaveAttendanceRules = async () => {
    try {
      setSaving(true);
      await settingsService.updateAttendanceRules(attendanceRules);
      toast.success('Attendance rules saved successfully!');
    } catch (error) {
      toast.error('Failed to save attendance rules');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.name || !newHoliday.date) return toast.error('Name and Date are required');
    try {
      setSaving(true);
      const res = await api.post('/employees/holidays', newHoliday);
      if (res.data.success) {
        toast.success('Holiday added');
        setNewHoliday({ name: '', date: '', type: 'Public' });
        fetchHolidays();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add holiday');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Delete this holiday?')) return;
    try {
      const res = await api.delete(`/employees/holidays/${id}`);
      if (res.data.success) {
        toast.success('Holiday deleted');
        fetchHolidays();
      }
    } catch (error) {
      toast.error('Failed to delete holiday');
    }
  };

  const handleCampaignChange = (platform, field, value) => {
    setCampaignData(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value
      }
    }));
    // Clear error when user types
    if (campaignErrors[platform]) {
      setCampaignErrors(prev => ({ ...prev, [platform]: null }));
    }
  };

  const handleSaveCampaigns = async () => {
    // Validate before save
    const validators = {
      facebookPixel: /^\d+$/,
      googleTagManager: /^GTM-[A-Z0-9]+$/,
      googleAds: /^AW-\d+$/,
      linkedInInsight: /^\d+$/
    };
    
    let hasError = false;
    let newErrors = {};

    Object.keys(validators).forEach(platform => {
      if (campaignData[platform]?.enabled && campaignData[platform]?.id) {
        if (!validators[platform].test(campaignData[platform].id)) {
          newErrors[platform] = `Invalid format for ${platform} ID.`;
          hasError = true;
        }
      }
    });

    if (hasError) {
      setCampaignErrors(newErrors);
      toast.error('Please fix the validation errors before saving.');
      return;
    }

    try {
      setSaving(true);
      const res = await settingsService.updateCampaignSettings(campaignData);
      setCampaignData(res.data);
      toast.success('Campaign settings saved successfully!');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        toast.error('Validation failed on server.');
      } else {
        toast.error('Failed to save campaign settings.');
      }
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'contact', label: 'Contact Info', icon: Phone },
    { id: 'officeTimings', label: 'Office Timings', icon: Clock },
    { id: 'attendanceRules', label: 'Attendance Rules', icon: Clock },
    { id: 'holidays', label: 'Holiday Calendar', icon: Database },
    ...(can('leads.assign') ? [{ id: 'assignmentRules', label: 'Assignment Rules', icon: Share2 }] : []),
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'campaigns', label: 'Campaign Control', icon: BarChart2 },
    { id: 'payment', label: 'Payment Settings', icon: CreditCard },
    { id: 'backups', label: 'Backups', icon: Database },
  ];

  const inputClasses = "w-full bg-[#121215] border border-[#2D2D33] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-all duration-300";
  const labelClasses = "block text-[12px] font-medium text-gray-400 mb-1.5 font-mono uppercase tracking-wider";

  return (
    <div className="relative min-h-[calc(100vh-80px)] bg-[#1A1A1A] rounded-xl border border-[#2D2D33] overflow-hidden flex flex-col md:flex-row">
      
      {/* Sidebar Tabs */}
      <div className="w-full md:w-64 bg-[#16161A] border-r border-[#2D2D33] flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-6">Settings</h2>
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${
                    isActive 
                      ? 'bg-[#FF6B00]/10 text-[#FF6B00] shadow-[0_0_15px_rgba(255,107,0,0.1)]' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-[#FF6B00]' : 'text-gray-500'} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar relative pb-24">
        
        {/* Contact Tab */}
        {activeTab === 'contact' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">Contact & Global Info</h3>
            <p className="text-gray-400 text-sm mb-8">Manage the contact details displayed across the website.</p>

            {loading ? (
              <div className="text-gray-400">Loading...</div>
            ) : (
              <div className="space-y-8">
                <div>
                  <h4 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-widest mb-4 flex items-center gap-4">
                    <span>Basic Details</span>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-[#FF6B00]/30 to-transparent"></div>
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClasses}>Email Address</label>
                      <input type="email" name="email" value={contactData.email} onChange={handleContactChange} className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>Working Hours</label>
                      <input type="text" name="hours" value={contactData.hours} onChange={handleContactChange} placeholder="e.g. Mon – Fri: 8:00am – 7:00pm" className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>Phone Number (Link)</label>
                      <input type="text" name="phone" value={contactData.phone} onChange={handleContactChange} placeholder="+91 86524 10289" className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>Phone Number (Display)</label>
                      <input type="text" name="phoneDisplay" value={contactData.phoneDisplay} onChange={handleContactChange} placeholder="+91 86524 10289" className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>WhatsApp Number</label>
                      <input type="text" name="whatsappNumber" value={contactData.whatsappNumber} onChange={handleContactChange} placeholder="e.g. 917049380550 (with country code)" className={inputClasses} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelClasses}>WhatsApp Default Message</label>
                      <input type="text" name="whatsappMessage" value={contactData.whatsappMessage} onChange={handleContactChange} placeholder="Hi! I want to know more about your services." className={inputClasses} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelClasses}>Address</label>
                      <input type="text" name="address" value={contactData.address} onChange={handleContactChange} className={inputClasses} />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-widest mb-4 flex items-center gap-4">
                    <span>Legal & Copyright</span>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-[#FF6B00]/30 to-transparent"></div>
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className={labelClasses}>Copyright Text</label>
                      <input type="text" name="copyright" value={contactData.copyright} onChange={handleContactChange} className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>Registration Details</label>
                      <input type="text" name="registration" value={contactData.registration} onChange={handleContactChange} className={inputClasses} />
                    </div>
                    <div>
                      <label className={labelClasses}>CIN</label>
                      <input type="text" name="cin" value={contactData.cin} onChange={handleContactChange} className={inputClasses} />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-widest mb-4 flex items-center gap-4">
                    <span>Social Media Links</span>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-[#FF6B00]/30 to-transparent"></div>
                  </h4>
                  <div className="space-y-4">
                    {contactData.socialLinks.map((link, index) => (
                      <div key={link.id || index} className="flex gap-4 items-start">
                        <div className="flex-1">
                          <label className={labelClasses}>Platform Name</label>
                          <input type="text" value={link.platform} onChange={(e) => handleSocialLinkChange(index, 'platform', e.target.value)} placeholder="e.g. Facebook, Twitter" className={inputClasses} />
                        </div>
                        <div className="flex-[2]">
                          <label className={labelClasses}>URL</label>
                          <input type="text" value={link.url} onChange={(e) => handleSocialLinkChange(index, 'url', e.target.value)} placeholder="https://..." className={inputClasses} />
                        </div>
                        <div className="pt-7">
                          <button onClick={() => removeSocialLink(index)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors text-xs font-semibold uppercase tracking-wider">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    <button onClick={addSocialLink} className="px-4 py-2 mt-2 bg-[#121215] border border-[#2D2D33] text-white hover:text-[#FF6B00] hover:border-[#FF6B00] rounded-lg transition-all text-sm font-medium">
                      + Add Social Link
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">API Integrations</h3>
            <p className="text-gray-400 text-sm mb-8">Connect external services to power your workflows.</p>

            <div className="space-y-8">
              <div>
                <h4 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-widest mb-4 flex items-center gap-4">
                  <span>Communication APIs</span>
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-[#FF6B00]/30 to-transparent"></div>
                </h4>
                <div className="space-y-6">
                  <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#25D366]"></div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                        <Smartphone size={20} className="text-[#25D366]" />
                      </div>
                      <div>
                        <h5 className="text-white font-semibold">WhatsApp Business API</h5>
                        <p className="text-xs text-gray-400">For lead notifications and client updates.</p>
                      </div>
                    </div>
                    <div>
                      <label className={labelClasses}>API Token</label>
                      <input type="password" placeholder="Enter WhatsApp Token" className={inputClasses} />
                    </div>
                  </div>

                  <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#EA4335]"></div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-full bg-[#EA4335]/10 flex items-center justify-center">
                        <Mail size={20} className="text-[#EA4335]" />
                      </div>
                      <div>
                        <h5 className="text-white font-semibold">Email Service Settings</h5>
                        <p className="text-xs text-gray-400">Configure global sender and receiver email addresses.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className={labelClasses}>Sender Email (EMAIL_FROM)</label>
                        <input type="text" name="emailFrom" value={emailSettings.emailFrom} onChange={handleEmailSettingsChange} placeholder="e.g. noreply@vedhunt.in" className={inputClasses} />
                        <p className="text-xs text-gray-500 mt-1">This email will be used to send all outgoing emails.</p>
                      </div>
                      <div className="col-span-2">
                        <label className={labelClasses}>Admin Notification Email (HR_EMAIL)</label>
                        <input type="text" name="hrEmail" value={emailSettings.hrEmail} onChange={handleEmailSettingsChange} placeholder="e.g. hr@vedhunt.in" className={inputClasses} />
                        <p className="text-xs text-gray-500 mt-1">This email will receive all lead notifications and application submissions.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">Campaign Control</h3>
            <p className="text-gray-400 text-sm mb-4">Manage global tracking pixels and conversion labels across all platforms.</p>
            
            {campaignData.audit && campaignData.audit.updatedAt && (
              <div className="bg-[#121215] border border-[#2D2D33] p-4 rounded-xl mb-8 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#FF6B00]/10 flex items-center justify-center">
                  <User size={16} className="text-[#FF6B00]" />
                </div>
                <div>
                  <p className="text-sm text-gray-300">Last updated by <span className="font-semibold text-white">{campaignData.audit.updatedBy}</span></p>
                  <p className="text-xs text-gray-500">{new Date(campaignData.audit.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-gray-400">Loading...</div>
            ) : (
              <div className="space-y-6">
                
                {/* Facebook Pixel */}
                <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
                        <Share2 size={20} className="text-[#1877F2]" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">Meta (Facebook) Pixel</h4>
                        <p className="text-xs text-gray-400">Track standard PageView and Lead events.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={campaignData.facebookPixel?.enabled} onChange={(e) => handleCampaignChange('facebookPixel', 'enabled', e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF6B00]"></div>
                    </label>
                  </div>
                  <div className={`transition-all duration-300 ${campaignData.facebookPixel?.enabled ? 'opacity-100 h-auto' : 'opacity-50 pointer-events-none'}`}>
                    <label className={labelClasses}>Pixel ID</label>
                    <input type="text" placeholder="e.g. 123456789012345" value={campaignData.facebookPixel?.id} onChange={(e) => handleCampaignChange('facebookPixel', 'id', e.target.value)} className={`${inputClasses} ${campaignErrors.facebookPixel ? 'border-red-500' : ''}`} />
                    {campaignErrors.facebookPixel && <p className="text-red-500 text-xs mt-1">{campaignErrors.facebookPixel}</p>}
                  </div>
                </div>



                {/* Google Tag Manager */}
                <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#4285F4]/10 flex items-center justify-center">
                        <Plug size={20} className="text-[#4285F4]" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">Google Tag Manager</h4>
                        <p className="text-xs text-gray-400">Manage all tags centrally via GTM.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={campaignData.googleTagManager?.enabled} onChange={(e) => handleCampaignChange('googleTagManager', 'enabled', e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF6B00]"></div>
                    </label>
                  </div>
                  <div className={`transition-all duration-300 ${campaignData.googleTagManager?.enabled ? 'opacity-100 h-auto' : 'opacity-50 pointer-events-none'}`}>
                    <label className={labelClasses}>Container ID</label>
                    <input type="text" placeholder="e.g. GTM-XXXXXXX" value={campaignData.googleTagManager?.id} onChange={(e) => handleCampaignChange('googleTagManager', 'id', e.target.value)} className={`${inputClasses} ${campaignErrors.googleTagManager ? 'border-red-500' : ''}`} />
                    {campaignErrors.googleTagManager && <p className="text-red-500 text-xs mt-1">{campaignErrors.googleTagManager}</p>}
                  </div>
                </div>

                {/* Google Ads */}
                <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#34A853]/10 flex items-center justify-center">
                        <Database size={20} className="text-[#34A853]" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">Google Ads Tracking</h4>
                        <p className="text-xs text-gray-400">Track specific lead conversions directly in Google Ads.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={campaignData.googleAds?.enabled} onChange={(e) => handleCampaignChange('googleAds', 'enabled', e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF6B00]"></div>
                    </label>
                  </div>
                  <div className={`transition-all duration-300 ${campaignData.googleAds?.enabled ? 'opacity-100 h-auto' : 'opacity-50 pointer-events-none'} space-y-4`}>
                    <div>
                      <label className={labelClasses}>Conversion ID</label>
                      <input type="text" placeholder="e.g. AW-123456789" value={campaignData.googleAds?.id} onChange={(e) => handleCampaignChange('googleAds', 'id', e.target.value)} className={`${inputClasses} ${campaignErrors.googleAds ? 'border-red-500' : ''}`} />
                      {campaignErrors.googleAds && <p className="text-red-500 text-xs mt-1">{campaignErrors.googleAds}</p>}
                    </div>
                    <div>
                      <label className={labelClasses}>Conversion Label (Lead Event)</label>
                      <input type="text" placeholder="e.g. abcdEFGHijklMNOP" value={campaignData.googleAds?.conversionLabel} onChange={(e) => handleCampaignChange('googleAds', 'conversionLabel', e.target.value)} className={inputClasses} />
                    </div>
                  </div>
                </div>

                {/* LinkedIn Insight */}
                <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#0077B5]/10 flex items-center justify-center">
                        <Share2 size={20} className="text-[#0077B5]" />
                      </div>
                      <div>
                        <h4 className="text-white font-semibold">LinkedIn Insight Tag</h4>
                        <p className="text-xs text-gray-400">Track professional demographics and B2B conversions.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={campaignData.linkedInInsight?.enabled} onChange={(e) => handleCampaignChange('linkedInInsight', 'enabled', e.target.checked)} />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF6B00]"></div>
                    </label>
                  </div>
                  <div className={`transition-all duration-300 ${campaignData.linkedInInsight?.enabled ? 'opacity-100 h-auto' : 'opacity-50 pointer-events-none'}`}>
                    <label className={labelClasses}>Partner ID</label>
                    <input type="text" placeholder="e.g. 1234567" value={campaignData.linkedInInsight?.id} onChange={(e) => handleCampaignChange('linkedInInsight', 'id', e.target.value)} className={`${inputClasses} ${campaignErrors.linkedInInsight ? 'border-red-500' : ''}`} />
                    {campaignErrors.linkedInInsight && <p className="text-red-500 text-xs mt-1">{campaignErrors.linkedInInsight}</p>}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* Payment Settings Tab */}
        {activeTab === 'payment' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">Payment Settings</h3>
            <p className="text-gray-400 text-sm mb-8">
              Configure UPI and bank details shown to clients on unpaid invoices in the Client Portal.
            </p>

            <div className="space-y-6">
              {/* UPI */}
              <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-[#FF6B00]/10 flex items-center justify-center">
                    <QrCode size={20} className="text-[#FF6B00]" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">UPI Payment</h4>
                    <p className="text-xs text-gray-400">Shown as a scannable QR and copyable UPI ID on invoices.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClasses}>UPI ID</label>
                    <input
                      type="text"
                      value={paymentSettings.upiId}
                      onChange={e => setPaymentSettings(p => ({ ...p, upiId: e.target.value }))}
                      placeholder="e.g. vedhunt@upi"
                      className={inputClasses}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className={labelClasses}>QR Code Image URL / Upload</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={paymentSettings.upiQrCodeUrl}
                        onChange={e => setPaymentSettings(p => ({ ...p, upiQrCodeUrl: e.target.value }))}
                        placeholder="https://res.cloudinary.com/..."
                        className={`flex-1 ${inputClasses}`}
                      />
                      <label className="flex items-center justify-center px-4 bg-[#2D2D33] hover:bg-[#3D3D43] text-white rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                        {uploadingQr ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <UploadCloud size={16} className="mr-2" />
                            <span className="text-sm font-medium">Upload</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleQrUpload}
                          className="hidden"
                          disabled={uploadingQr}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                {paymentSettings.upiQrCodeUrl && (
                  <div className="mt-4 flex items-center gap-4">
                    <img
                      src={paymentSettings.upiQrCodeUrl}
                      alt="UPI QR Preview"
                      className="w-24 h-24 object-contain rounded-xl border border-[#2D2D33] bg-white p-1"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                    <p className="text-gray-500 text-xs">QR Preview</p>
                  </div>
                )}
              </div>

              {/* Bank Transfer */}
              <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-[#FF6B00]/10 flex items-center justify-center">
                    <CreditCard size={20} className="text-[#FF6B00]" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">Bank Transfer Details</h4>
                    <p className="text-xs text-gray-400">Displayed as an alternative payment method on invoices.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { k: 'accountName', label: 'Account Holder Name' },
                    { k: 'accountNumber', label: 'Account Number' },
                    { k: 'ifscCode', label: 'IFSC Code' },
                    { k: 'bankName', label: 'Bank Name' },
                  ].map(({ k, label }) => (
                    <div key={k}>
                      <label className={labelClasses}>{label}</label>
                      <input
                        type="text"
                        value={paymentSettings.bankDetails?.[k] || ''}
                        onChange={e => setPaymentSettings(p => ({
                          ...p,
                          bankDetails: { ...(p.bankDetails || {}), [k]: e.target.value }
                        }))}
                        className={inputClasses}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSavePaymentSettings}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e55c00] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {saving
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save size={16} />
                }
                Save Payment Settings
              </button>
            </div>
          </div>
        )}

        {/* Backups Tab */}
        {activeTab === 'backups' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">Data & Backups</h3>
            <p className="text-gray-400 text-sm mb-8">Export your system data securely.</p>
            
            <div className="bg-[#121215] border border-[#2D2D33] p-8 rounded-xl text-center">
              <div className="w-16 h-16 rounded-full bg-[#FF6B00]/10 flex items-center justify-center mx-auto mb-4">
                <DownloadCloud size={28} className="text-[#FF6B00]" />
              </div>
              <h5 className="text-white font-semibold text-lg mb-2">Export Full Database</h5>
              <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">Download a complete Excel (.xlsx) backup of all leads, projects, and financial records.</p>
              
              <button className="px-6 py-2.5 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                Generate Backup Archive
              </button>
            </div>
          </div>
        )}

        {/* Office Timings Tab */}
        {activeTab === 'officeTimings' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">Office Timings</h3>
            <p className="text-gray-400 text-sm mb-8">Manage standard clock-in and clock-out times to track late arrivals.</p>
            
            {loading ? (
              <div className="text-gray-400">Loading...</div>
            ) : (
              <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className={labelClasses}>Standard Start Time</label>
                    <input 
                      type="time" 
                      name="standardStartTime" 
                      value={officeTimings.standardStartTime || ''} 
                      onChange={handleOfficeTimingsChange} 
                      className={inputClasses} 
                    />
                    <p className="text-xs text-gray-500 mt-2">Employees clocking in after this time will receive a Late flag.</p>
                  </div>
                  <div>
                    <label className={labelClasses}>Standard End Time</label>
                    <input 
                      type="time" 
                      name="standardEndTime" 
                      value={officeTimings.standardEndTime || ''} 
                      onChange={handleOfficeTimingsChange} 
                      className={inputClasses} 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attendance Rules Tab */}
        {activeTab === 'attendanceRules' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">Attendance Rules</h3>
            <p className="text-gray-400 text-sm mb-8">Manage half-day limits and default leave balances.</p>
            
            {loading ? (
              <div className="text-gray-400">Loading...</div>
            ) : (
              <div className="space-y-6">
                <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl">
                  <h4 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-widest mb-4">Half Day Rules</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className={labelClasses}>Late Check-In Limit (Half Day)</label>
                      <input 
                        type="time" 
                        name="halfDayCheckInLimit" 
                        value={attendanceRules.halfDayCheckInLimit || ''} 
                        onChange={handleAttendanceRulesChange} 
                        className={inputClasses} 
                      />
                      <p className="text-xs text-gray-500 mt-2">Check-ins after this time will trigger a Half Day.</p>
                    </div>
                    <div>
                      <label className={labelClasses}>Min. Hours Threshold (Half Day)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        name="halfDayHoursThreshold" 
                        value={attendanceRules.halfDayHoursThreshold || ''} 
                        onChange={handleAttendanceRulesChange} 
                        className={inputClasses} 
                      />
                      <p className="text-xs text-gray-500 mt-2">Less than these total working hours triggers a Half Day.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-widest">
                      Leave Balances (Per {attendanceRules.leaveBalancePeriod || 'Year'})
                    </h4>
                    <select 
                      value={attendanceRules.leaveBalancePeriod || 'Year'}
                      onChange={(e) => handleAttendanceRulesChange(e, false, 'leaveBalancePeriod')}
                      name="leaveBalancePeriod"
                      className="bg-[#1e1e21] border border-[#2D2D33] text-xs text-white px-2 py-1 rounded focus:outline-none focus:border-orange-500"
                    >
                      <option value="Year">Per Year</option>
                      <option value="Month">Per Month</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <label className={labelClasses}>Casual Leave (CL)</label>
                      <input 
                        type="number" 
                        name="CL" 
                        value={attendanceRules.defaultLeaves?.CL ?? ''} 
                        onChange={(e) => handleAttendanceRulesChange(e, true, 'defaultLeaves')} 
                        className={inputClasses} 
                      />
                    </div>
                    <div>
                      <label className={labelClasses}>Sick Leave (SL)</label>
                      <input 
                        type="number" 
                        name="SL" 
                        value={attendanceRules.defaultLeaves?.SL ?? ''} 
                        onChange={(e) => handleAttendanceRulesChange(e, true, 'defaultLeaves')} 
                        className={inputClasses} 
                      />
                    </div>
                    <div>
                      <label className={labelClasses}>Paid Leave (PL)</label>
                      <input 
                        type="number" 
                        name="PL" 
                        value={attendanceRules.defaultLeaves?.PL ?? ''} 
                        onChange={(e) => handleAttendanceRulesChange(e, true, 'defaultLeaves')} 
                        className={inputClasses} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Holidays Tab */}
        {activeTab === 'holidays' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">Company Holiday Calendar</h3>
            <p className="text-gray-400 text-sm mb-8">Manage official non-working holidays. Employees get paid leaves for these days.</p>
            
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-widest">Holidays for {selectedYear}</h4>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-[#121215] border border-[#2D2D33] rounded-lg px-4 py-2 text-white outline-none"
              >
                {[...Array(5)].map((_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>

            <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl mb-8">
              <form onSubmit={handleAddHoliday} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                <div className="col-span-1">
                  <label className={labelClasses}>Date</label>
                  <input type="date" required value={newHoliday.date} onChange={e => setNewHoliday({...newHoliday, date: e.target.value})} className={inputClasses} style={{ colorScheme: 'dark' }} />
                </div>
                <div className="col-span-1">
                  <label className={labelClasses}>Holiday Name</label>
                  <input type="text" required placeholder="Diwali" value={newHoliday.name} onChange={e => setNewHoliday({...newHoliday, name: e.target.value})} className={inputClasses} />
                </div>
                <div className="col-span-1">
                  <label className={labelClasses}>Type</label>
                  <select value={newHoliday.type} onChange={e => setNewHoliday({...newHoliday, type: e.target.value})} className={inputClasses}>
                    <option value="Public">Public</option>
                    <option value="Restricted">Restricted</option>
                  </select>
                </div>
                <div className="col-span-1">
                  <button type="submit" disabled={saving} className="w-full bg-[#FF6B00] hover:bg-[#EA580C] text-white px-4 py-2 rounded-lg font-bold transition-all h-[42px] whitespace-nowrap">
                    Add Holiday
                  </button>
                </div>
              </form>
            </div>

            {loading ? (
              <div className="text-gray-400">Loading...</div>
            ) : (
              <div className="bg-[#121215] border border-[#2D2D33] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300 min-w-[500px]">
                  <thead className="bg-[#1A1A1E] text-xs uppercase text-gray-400 border-b border-[#2D2D33]">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D2D33]">
                    {holidays.length === 0 ? (
                      <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No holidays found for {selectedYear}</td></tr>
                    ) : (
                      holidays.map(h => (
                        <tr key={h._id} className="hover:bg-white/[0.02]">
                          <td className="px-6 py-4 font-mono">{new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="px-6 py-4 font-semibold text-white">{h.name}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${h.type === 'Public' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                              {h.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDeleteHoliday(h._id)} className="text-red-500 hover:text-red-400 font-medium text-xs">Delete</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Assignment Rules Tab */}
        {activeTab === 'assignmentRules' && (
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-2xl font-bold text-white mb-2">Lead Assignment Rules</h3>
            <p className="text-gray-400 text-sm mb-8">
              Manual assignment is always available from the Leads page. Turn on automated round-robin here to have new leads assigned automatically per the rules below.
            </p>

            <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl mb-8 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Automated Round-Robin</h4>
                <p className="text-xs text-gray-400 mt-1">When off, new leads are left Unassigned for manual assignment.</p>
              </div>
              <button
                onClick={handleToggleAutoAssign}
                className={`relative w-12 h-6 rounded-full transition-colors ${autoAssignEnabled ? 'bg-[#FF6B00]' : 'bg-[#2D2D33]'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${autoAssignEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="bg-[#121215] border border-[#2D2D33] p-6 rounded-xl mb-8">
              <h4 className="text-sm font-semibold text-[#FF6B00] uppercase tracking-widest mb-4">
                {editingRuleId ? 'Edit Rule' : 'New Rule'}
              </h4>
              <form onSubmit={handleSubmitRule} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClasses}>Rule Name</label>
                    <input type="text" required placeholder="e.g. SEO leads" value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })} className={inputClasses} />
                  </div>
                  <div>
                    <label className={labelClasses}>Priority (lower runs first)</label>
                    <input type="number" value={ruleForm.priority} onChange={e => setRuleForm({ ...ruleForm, priority: Number(e.target.value) })} className={inputClasses} />
                  </div>
                  <div>
                    <label className={labelClasses}>Match Service (blank = any)</label>
                    <input type="text" placeholder="e.g. SEO" value={ruleForm.matchService} onChange={e => setRuleForm({ ...ruleForm, matchService: e.target.value })} className={inputClasses} />
                  </div>
                  <div>
                    <label className={labelClasses}>Match Source (blank = any)</label>
                    <input type="text" placeholder="e.g. Website, Facebook" value={ruleForm.matchSource} onChange={e => setRuleForm({ ...ruleForm, matchSource: e.target.value })} className={inputClasses} />
                  </div>
                  <div>
                    <label className={labelClasses}>Max Active Leads per BD (blank = unlimited)</label>
                    <input type="number" min="0" placeholder="Unlimited" value={ruleForm.maxActiveLeads} onChange={e => setRuleForm({ ...ruleForm, maxActiveLeads: e.target.value })} className={inputClasses} />
                  </div>
                </div>
                <div>
                  <label className={labelClasses}>BD Pool (rotation order)</label>
                  {bdRoster.length === 0 ? (
                    <p className="text-xs text-gray-500">No BD accounts found yet — create BD team members first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {bdRoster.map((bd) => (
                        <button
                          type="button"
                          key={bd._id}
                          onClick={() => toggleBdInPool(bd._id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            ruleForm.bdPool.includes(bd._id)
                              ? 'bg-[#FF6B00]/10 border-[#FF6B00] text-[#FF6B00]'
                              : 'bg-transparent border-[#2D2D33] text-gray-400 hover:text-white'
                          }`}
                        >
                          {bd.firstName} {bd.lastName} ({bd.activeLeadCount} active)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="bg-[#FF6B00] hover:bg-[#EA580C] text-white px-4 py-2 rounded-lg font-bold transition-all">
                    {editingRuleId ? 'Update Rule' : 'Add Rule'}
                  </button>
                  {editingRuleId && (
                    <button type="button" onClick={() => { setEditingRuleId(null); setRuleForm(emptyRuleForm); }} className="px-4 py-2 rounded-lg font-bold text-gray-400 hover:text-white transition-all">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {loading ? (
              <div className="text-gray-400">Loading...</div>
            ) : (
              <div className="bg-[#121215] border border-[#2D2D33] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300 min-w-[600px]">
                  <thead className="bg-[#1A1A1E] text-xs uppercase text-gray-400 border-b border-[#2D2D33]">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Match</th>
                      <th className="px-6 py-4">BD Pool</th>
                      <th className="px-6 py-4">Cap</th>
                      <th className="px-6 py-4">Active</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D2D33]">
                    {assignmentRules.length === 0 ? (
                      <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">No rules yet — new leads stay Unassigned until you add one.</td></tr>
                    ) : (
                      assignmentRules.map(rule => (
                        <tr key={rule._id} className="hover:bg-white/[0.02]">
                          <td className="px-6 py-4 font-semibold text-white">{rule.name}</td>
                          <td className="px-6 py-4 text-xs text-gray-400">
                            {rule.matchService || 'Any service'} · {rule.matchSource || 'Any source'}
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-400">{(rule.bdPool || []).length} BD(s)</td>
                          <td className="px-6 py-4 text-xs text-gray-400">{rule.maxActiveLeads ?? 'Unlimited'}</td>
                          <td className="px-6 py-4">
                            <button onClick={() => handleToggleRuleActive(rule)} className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${rule.active ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-400'}`}>
                              {rule.active ? 'Active' : 'Paused'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                            <button onClick={() => handleEditRule(rule)} className="text-[#FF6B00] hover:text-[#EA580C] font-medium text-xs">Edit</button>
                            <button onClick={() => handleDeleteRule(rule._id)} className="text-red-500 hover:text-red-400 font-medium text-xs">Delete</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Sticky Floating Action Button */}
      <div className="absolute bottom-6 right-6 z-10">
        <button 
          onClick={() => {
            if (activeTab === 'contact') handleSaveContact();
            if (activeTab === 'integrations') handleSaveIntegrations();
            if (activeTab === 'campaigns') handleSaveCampaigns();
            if (activeTab === 'officeTimings') handleSaveOfficeTimings();
            if (activeTab === 'attendanceRules') handleSaveAttendanceRules();
            if (activeTab === 'holidays') fetchHolidays();
            if (activeTab === 'payment') handleSavePaymentSettings();
            if (activeTab === 'assignmentRules') fetchAssignmentRules();
          }}
          disabled={saving}
          className={`flex items-center gap-2 bg-[#FF6B00] hover:bg-[#EA580C] text-white px-6 py-3 rounded-full font-bold shadow-[0_4px_20px_rgba(255,107,0,0.4)] transition-all ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

    </div>
  );
};

export default SettingsPage;
