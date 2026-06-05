import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  ArrowRight, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  FileText,
  Search,
  ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import careerHeroImg from '../assets/services/career-new-hero.png';

export default function Career() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [heroData, setHeroData] = useState(null);
  const [isLoadingHero, setIsLoadingHero] = useState(true);
  const [lifeAtVedhuntData, setLifeAtVedhuntData] = useState(null);
  const [isLoadingCulture, setIsLoadingCulture] = useState(true);
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    fetchJobs();
    fetchHeroData();
    fetchLifeAtVedhunt();
  }, []);

  const fetchLifeAtVedhunt = async () => {
    try {
      setIsLoadingCulture(true);
      const res = await api.get('/content/life-at-vedhunt');
      if (res.data?.success && res.data?.data) {
        setLifeAtVedhuntData(res.data.data);
      }
    } catch (error) {
      console.error('Failed to load life at vedhunt content', error);
    } finally {
      setIsLoadingCulture(false);
    }
  };

  const fetchHeroData = async () => {
    try {
      setIsLoadingHero(true);
      const res = await api.get('/content/career-hero');
      if (res.data?.success && res.data?.data) {
        setHeroData(res.data.data);
      }
    } catch (error) {
      console.error('Failed to load career hero content', error);
    } finally {
      setIsLoadingHero(false);
    }
  };

  const fetchJobs = async () => {
    try {
      setIsLoadingJobs(true);
      const res = await api.get('/jobs?status=Published');
      setJobs(res.data || []);
    } catch (error) {
      console.error('Failed to load jobs', error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset
  } = useForm({
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      position: 'general',
      experience: '',
      currentCTC: '',
      expectedCTC: '',
      noticePeriod: '',
      message: '',
      linkedinUrl: '',
      portfolioUrl: ''
    }
  });

  const selectedPosition = watch('position');
  const selectedJob = selectedPosition === 'general' ? null : selectedPosition;

  const onSubmitForm = async (data) => {
    const jobInfo = selectedJob ? jobs.find(p => p._id === selectedJob) : null;
    const jobTitle = jobInfo ? jobInfo.title : 'General Application';
    
    // Create FormData for multipart submission
    const formData = new FormData();
    if (jobInfo) formData.append('jobId', jobInfo._id);
    formData.append('fullName', data.fullName);
    formData.append('email', data.email);
    formData.append('phone', data.phone);
    formData.append('experienceYears', data.experience);
    if (data.currentCTC) formData.append('currentCTC', data.currentCTC);
    if (data.expectedCTC) formData.append('expectedCTC', data.expectedCTC);
    if (data.noticePeriod) formData.append('noticePeriod', data.noticePeriod);
    if (data.linkedinUrl) formData.append('linkedinUrl', data.linkedinUrl);
    if (data.portfolioUrl) formData.append('portfolioUrl', data.portfolioUrl);
    if (data.message) formData.append('coverLetter', data.message);
    
    const fileInput = document.getElementById('resume-upload');
    if (fileInput && fileInput.files[0]) {
      formData.append('resume', fileInput.files[0]);
    } else {
      toast.error("Resume is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/applications', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      reset();
      setFileName('');
      setFileError('');
      if (fileInput) fileInput.value = '';
      
      // Redirect to success page
      navigate('/career/success', { state: { fullName: data.fullName, jobTitle } });
    } catch (error) {
      const apiErrors = error.response?.data?.errors;
      if (apiErrors && apiErrors.length > 0) {
        apiErrors.forEach(e => toast.error(`${e.field}: ${e.message}`));
      } else {
        toast.error(error.response?.data?.message || 'Failed to submit application');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = (errors) => {
    Object.values(errors).forEach(error => {
      toast.error(error.message);
    });
  };

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Only PDF and DOC/DOCX are allowed.');
        e.target.value = '';
        setFileName('');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size exceeds 5MB limit.');
        e.target.value = '';
        setFileName('');
        return;
      }
      
      setFileName(file.name);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text relative pt-24 sm:pt-36 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* Universal Floating Mesh Backdrop */}
      <div className="absolute inset-0 mesh-grid opacity-35 pointer-events-none z-0" />

      {/* Decorative Orbs */}
      <div className="absolute top-1/3 -left-20 w-[450px] h-[450px] bg-primary/5 rounded-full filter blur-[150px] pointer-events-none z-0" />
      <div className="absolute bottom-1/3 -right-20 w-[450px] h-[450px] bg-primary/4 rounded-full filter blur-[150px] pointer-events-none z-0" />

      {/* Top Right Fluid Curve Background */}
      <div className="absolute top-0 right-0 w-[85%] md:w-[65%] lg:w-[50%] h-[600px] lg:h-[750px] pointer-events-none z-0">
        <svg viewBox="0 0 900 600" preserveAspectRatio="none" className="w-full h-full text-primary" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path opacity="0.15" d="M900,0 H250 C350,200 550,150 550,350 C550,550 150,500 200,600 H900 V0 Z" />
          <path opacity="0.3" d="M900,0 H400 C500,150 700,200 700,350 C700,500 300,550 350,600 H900 V0 Z" />
          <path opacity="0.6" d="M900,0 H550 C650,100 800,250 800,400 C800,550 450,580 500,600 H900 V0 Z" />
        </svg>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-20">
        
        {/* New Hero Section */}
        <div className="flex flex-col-reverse lg:flex-row items-center lg:items-start justify-between gap-2 sm:gap-12 lg:gap-20 mb-8 sm:mb-16 relative -mt-4 lg:-mt-8">
          
          {/* Left Content */}
          <div className="flex-1 space-y-4 lg:space-y-6 z-10 w-full max-w-xl text-center lg:text-left pt-0">
            {isLoadingHero ? (
              <div className="animate-pulse space-y-4">
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </div>
            ) : (
              <>
                <motion.h1 
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-4xl lg:text-5xl font-medium font-heading text-app-text leading-snug"
                >
                  {heroData?.headingTop || 'Join the'} <span className="text-primary font-semibold">{heroData?.headingHighlight || 'Vedhunt Team'}</span>
                </motion.h1>

                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-app-text-muted text-sm max-w-md mx-auto lg:mx-0 leading-relaxed"
                >
                  {heroData?.description || 'Build elite, high-performance digital products with a team of passionate engineers, creative designers, and strategic marketers.'}
                </motion.p>
              </>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <button 
                onClick={() => {
                  const el = document.getElementById('open-positions');
                  if(el) {
                    const y = el.getBoundingClientRect().top + window.scrollY - 100;
                    window.scrollTo({top: y, behavior: 'smooth'});
                  }
                }}
                className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold text-xs uppercase tracking-wider rounded-lg shadow-[0_0_15px_rgba(255,107,0,0.3)] hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                View Open Positions
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="pt-4 border-t border-app-border/30 max-w-lg mx-auto lg:mx-0 text-left mt-2"
            >
              <h3 className="text-[11px] uppercase tracking-wider font-semibold text-app-text-muted mb-2.5">Why Work With Us</h3>
              <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                {(heroData?.benefits?.length > 0 ? heroData.benefits : ['Growth Opportunities', 'Flexible Work', 'Learning Culture', 'Competitive Pay', 'Team Culture']).map((benefit, i) => (
                  <span key={i} className="px-2 py-1 bg-app-card hover:bg-primary/10 border border-app-border/50 hover:border-primary/30 rounded text-[10px] font-medium text-app-text-muted hover:text-app-text transition-colors cursor-default flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-primary" />
                    {benefit}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Image / Blob */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="flex-1 relative w-full flex justify-center lg:justify-end min-h-[200px] sm:min-h-[300px] lg:min-h-[350px] items-center lg:pr-8 -mb-6 sm:mb-0"
          >
            <img 
              src={careerHeroImg} 
              alt="Career Opportunities" 
              className="relative z-10 w-full max-w-[240px] sm:max-w-sm lg:max-w-[340px] object-contain dark:drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]"
            />
          </motion.div>
        </div>

        <div id="open-positions" className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start mt-12">
          
          {/* Left Column: Job Listings */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="space-y-2">
              <h2 className="text-2xl font-black font-heading text-app-text">Open Positions</h2>
              <p className="text-xs text-app-text-muted">Select a position below to apply directly.</p>
            </div>

            <div className="space-y-4">
              {isLoadingJobs ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto" />
                  <p className="text-sm text-app-text-muted mt-4">Loading open positions...</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12 bg-app-card rounded-xl border border-app-border">
                  <p className="text-app-text-muted">No open positions right now. Check back later!</p>
                </div>
              ) : (
                jobs.map((job) => (
                <motion.div
                  key={job._id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => {
                    setValue('position', job._id);
                    setTimeout(() => {
                      const formEl = document.getElementById('application-form');
                      if (formEl) {
                        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 50);
                  }}
                  className={`p-6 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                    selectedJob === job._id
                      ? 'bg-white dark:bg-app-card border-primary shadow-[0_10px_30px_rgba(232,71,10,0.15)]'
                      : 'bg-white dark:bg-app-card border-slate-100 dark:border-app-border hover:border-primary/30 shadow-sm dark:shadow-none hover:shadow-lg dark:hover:shadow-none'
                  }`}
                >
                  {selectedJob === job._id && (
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                  )}

                  <div className="space-y-4 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">
                          {job.department}
                        </span>
                        <h3 className="text-lg font-bold font-heading text-app-text mt-1.5">{job.title}</h3>
                      </div>
                      <span className="text-xs font-bold text-slate-600 dark:text-app-text-muted bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-app-border px-3 py-1 rounded-full flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-primary" />
                        <span>{job.type}</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-app-text-muted leading-relaxed whitespace-pre-line line-clamp-3">{job.description}</p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-app-text-muted/80 pt-2 border-t border-slate-100 dark:border-app-border/50">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        <span>{job.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>Experience: {job.experience}</span>
                      </div>
                    </div>
                  </div>

                  <button className="mt-6 w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors">
                    Apply Now <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )))}
            </div>
          </motion.div>

          {/* Right Column: Application & Resume Upload Form */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-5 relative" 
            id="application-form"
          >
            <div className="sticky top-28 glass-panel rounded-3xl p-8 border border-primary/20 bg-app-card shadow-2xl space-y-8">
              
              <div className="space-y-2 border-b border-app-border pb-4 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary block">Instant Application</span>
                  {selectedJob && (
                    <button 
                      type="button"
                      onClick={() => setValue('position', 'general')}
                      className="text-[10px] text-app-text-muted hover:text-primary transition-colors underline cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
                <h3 className="text-xl font-bold font-heading text-app-text mt-1">Submit Your Resume</h3>
              </div>

              <AnimatePresence mode="wait">
                  <motion.form
                    key="career-apply-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit(onSubmitForm, onInvalid)}
                    className="space-y-6"
                  >
                    {/* Position Applying For */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                        Position Applying For <span className="text-primary">*</span>
                      </label>
                      <div className="relative">
                        <select
                          className={`w-full bg-transparent border-b-2 py-2 text-black dark:text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium appearance-none cursor-pointer ${
                            errors.position ? 'border-red-500/50 focus:border-red-500' : 'border-black/20 dark:border-white/20'
                          }`}
                          {...register('position', { required: 'Please select a position' })}
                        >
                          <option value="general" className="bg-app-bg text-app-text">General Application</option>
                          {jobs.map(job => (
                            <option key={job._id} value={job._id} className="bg-app-bg text-app-text">{job.title}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted pointer-events-none" />
                      </div>
                    </div>
                    {/* Full Name */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                        Full Name <span className="text-primary">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        className={`w-full bg-transparent border-b-2 py-2 text-black dark:text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium placeholder:text-gray-500 ${
                          errors.fullName ? 'border-red-500/50 focus:border-red-500' : 'border-black/20 dark:border-white/20'
                        }`}
                        {...register('fullName', { 
                          required: 'Full name is required',
                          minLength: { value: 2, message: 'Minimum 2 characters required' },
                          maxLength: { value: 100, message: 'Maximum 100 characters allowed' },
                          pattern: { value: /^[a-zA-Z\s]+$/, message: 'Only letters and spaces allowed' }
                        })}
                      />
                    </div>

                    {/* Email Address */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                        Email Address <span className="text-primary">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. rahul@example.com"
                        className={`w-full bg-transparent border-b-2 py-2 text-black dark:text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium placeholder:text-gray-500 ${
                          errors.email ? 'border-red-500/50 focus:border-red-500' : 'border-black/20 dark:border-white/20'
                        }`}
                        {...register('email', { 
                          required: 'Email address is required',
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Please enter a valid email address'
                          }
                        })}
                      />
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                        Phone Number <span className="text-primary">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +91 98765 43210"
                        className={`w-full bg-transparent border-b-2 py-2 text-black dark:text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium placeholder:text-gray-500 ${
                          errors.phone ? 'border-red-500/50 focus:border-red-500' : 'border-black/20 dark:border-white/20'
                        }`}
                        {...register('phone', { 
                          required: 'Phone number is required',
                          pattern: {
                            value: /^\+?[0-9\s-]{10,15}$/,
                            message: 'Please enter a valid 10-15 digit phone number'
                          }
                        })}
                      />
                    </div>

                    {/* Years of Experience */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                        Years of Experience <span className="text-primary">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 5 Years"
                        className={`w-full bg-transparent border-b-2 py-2 text-black dark:text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium placeholder:text-gray-500 ${
                          errors.experience ? 'border-red-500/50 focus:border-red-500' : 'border-black/20 dark:border-white/20'
                        }`}
                        {...register('experience', { 
                          required: 'Experience is required',
                          pattern: { value: /^\d+$/, message: 'Please enter a valid number' },
                          min: { value: 0, message: 'Cannot be negative' },
                          max: { value: 50, message: 'Cannot exceed 50 years' }
                        })}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Current CTC */}
                      <div className="space-y-1.5 text-left relative group">
                        <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                          Current / Last CTC (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 12 LPA"
                          className="w-full bg-transparent border-b-2 py-2 text-black dark:text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium placeholder:text-gray-500 border-black/20 dark:border-white/20"
                          {...register('currentCTC', {
                            pattern: { value: /^\d+(\.\d+)?$/, message: 'Must be a valid number' }
                          })}
                        />
                      </div>

                      {/* Expected CTC */}
                      <div className="space-y-1.5 text-left relative group">
                        <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                          Expected CTC (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 15 LPA"
                          className="w-full bg-transparent border-b-2 py-2 text-black dark:text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium placeholder:text-gray-500 border-black/20 dark:border-white/20"
                          {...register('expectedCTC', {
                            pattern: { value: /^\d+(\.\d+)?$/, message: 'Must be a valid number' }
                          })}
                        />
                      </div>
                    </div>

                    {/* Notice Period */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                        Notice Period / Availability (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 30 days, Immediate"
                        className="w-full bg-transparent border-b-2 py-2 text-black dark:text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium placeholder:text-gray-500 border-black/20 dark:border-white/20"
                        {...register('noticePeriod', {
                          maxLength: { value: 50, message: 'Maximum 50 characters allowed' }
                        })}
                      />
                    </div>

                    {/* LinkedIn URL */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                        LinkedIn Profile URL (Optional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://linkedin.com/in/username"
                        className="w-full bg-transparent border-b-2 py-2 text-black dark:text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium placeholder:text-gray-500 border-black/20 dark:border-white/20"
                        {...register('linkedinUrl', {
                          pattern: { value: /^https?:\/\/.*/, message: 'Must be a valid URL starting with http/https' }
                        })}
                      />
                    </div>

                    {/* Portfolio / Work Samples URL */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                        Portfolio / Work Samples URL (Optional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://yourportfolio.com"
                        className="w-full bg-transparent border-b-2 py-2 text-black dark:text-white focus:outline-none focus:border-primary transition-colors text-sm font-medium placeholder:text-gray-500 border-black/20 dark:border-white/20"
                        {...register('portfolioUrl', {
                          pattern: { value: /^https?:\/\/.*/, message: 'Must be a valid URL starting with http/https' }
                        })}
                      />
                    </div>

                    {/* Drag & Drop Resume Upload Form */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                        Upload Resume (PDF/DOCX) <span className="text-primary">*</span>
                      </label>
                      
                      <div className="relative border-2 border-dashed border-app-border hover:border-primary/50 bg-app-bg/50 rounded-2xl p-6 text-center transition-all group cursor-pointer">
                        <input
                          id="resume-upload"
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          required
                        />
                        
                        <div className="space-y-2 flex flex-col items-center pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                            {fileName ? <FileText className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                          </div>
                          
                          <div className="text-xs font-bold text-app-text">
                            {fileName ? (
                              <span className="text-primary font-mono">{fileName}</span>
                            ) : (
                              <span>Click to upload or drag & drop</span>
                            )}
                          </div>
                          <p className="text-[10px] text-app-text-muted">PDF, DOCX up to 5MB</p>
                        </div>
                      </div>
                    </div>

                    {/* Cover Letter / Message */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest block">
                        Cover Letter / Notes
                      </label>
                      <textarea
                        rows="2"
                        placeholder="Briefly explain why you're a great fit for this role..."
                        className="w-full bg-transparent border-b-2 py-2 text-black dark:text-white focus:outline-none focus:border-primary transition-all resize-none text-sm font-medium placeholder:text-gray-500 border-black/20 dark:border-white/20"
                        {...register('message', {
                          maxLength: { value: 1000, message: 'Maximum 1000 characters allowed' }
                        })}
                      />
                    </div>

                    {/* Action Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 bg-primary hover:bg-primary-hover text-black font-extrabold text-xs uppercase tracking-widest rounded-full transition-all duration-300 shadow-[0_10px_25px_rgba(232,71,10,0.22)] hover:shadow-[0_12px_35px_rgba(232,71,10,0.45)] hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                    >
                      <span>{isSubmitting ? 'Submitting...' : 'Submit Application'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.form>
              </AnimatePresence>

            </div>
          </motion.div>

        </div>

        {/* Life at Vedhunt Section */}
        <div className="mt-20 pt-16 border-t border-app-border/30">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-heading text-app-text mb-4">
              {lifeAtVedhuntData?.header?.heading || 'Life at'} <span className="text-primary">{lifeAtVedhuntData?.header?.highlightText || 'Vedhunt'}</span>
            </h2>
            <p className="text-app-text-muted text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              {lifeAtVedhuntData?.header?.description || 'We believe in working hard, innovating continuously, and having fun along the way. Discover our vibrant culture, modern workspaces, and the incredible people driving our vision.'}
            </p>
          </div>

          {isLoadingCulture ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
          ) : (
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.15 }
                }
              }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 auto-rows-[180px] lg:auto-rows-[200px]"
            >
              {lifeAtVedhuntData?.cards?.map((card, idx) => (
                <motion.div 
                  key={card.title + idx}
                  variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
                  className={`${card.span === '2x' ? 'md:col-span-2' : 'col-span-1'} rounded-3xl overflow-hidden relative group cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.4)]`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/80 ${card.span === '2x' ? 'via-black/20' : 'via-transparent'} to-transparent ${card.span === '2x' ? 'group-hover:via-black/10 transition-colors duration-500' : ''} z-10 pointer-events-none`} />
                  <img 
                    src={card.image} 
                    alt={card.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute bottom-6 left-6 z-20">
                    <span className={`px-3 py-1 ${card.span === '2x' ? 'bg-primary text-black text-xs' : 'bg-white/90 text-black text-[10px]'} font-bold rounded uppercase tracking-wider mb-2 inline-block shadow-lg`}>
                      {card.tag}
                    </span>
                    <h3 className={`text-white ${card.span === '2x' ? 'text-2xl' : 'text-lg'} font-bold font-heading`}>
                      {card.title}
                    </h3>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}
