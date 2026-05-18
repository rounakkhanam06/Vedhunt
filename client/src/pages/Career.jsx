import { useState } from 'react';
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
  FileText 
} from 'lucide-react';

const OPEN_POSITIONS = [
  {
    id: 'react-architect',
    title: 'Senior React & Next.js Architect',
    department: 'Engineering',
    location: 'Remote / Navi Mumbai',
    type: 'Full Time',
    experience: '4+ Years',
    desc: 'Lead the architecture and development of scalable, high-performance web applications using React 19, Next.js, and modern state management ecosystems.'
  },
  {
    id: 'ui-ux-lead',
    title: 'UI/UX Designer & Design System Lead',
    department: 'Creative Design',
    location: 'Navi Mumbai',
    type: 'Full Time',
    experience: '3+ Years',
    desc: 'Craft premium, high-converting visual layouts, micro-interactions, and maintain comprehensive design systems in Figma for enterprise clients.'
  },
  {
    id: 'growth-marketer',
    title: 'Senior Growth Marketer & PPC Specialist',
    department: 'Marketing',
    location: 'Remote / Navi Mumbai',
    type: 'Full Time',
    experience: '3+ Years',
    desc: 'Scale client acquisition pipelines by managing high-budget Google Ads, Meta PPC, and LinkedIn ad campaigns with a focus on maximizing ROAS.'
  },
  {
    id: 'python-bi-engineer',
    title: 'Python Automation & Power BI Engineer',
    department: 'Data & BI',
    location: 'Navi Mumbai',
    type: 'Full Time',
    experience: '2+ Years',
    desc: 'Build automated data extraction pipelines (ETL) and design advanced, interactive Power BI executive dashboards for international finance clients.'
  }
];

export default function Career() {
  const [selectedJob, setSelectedJob] = useState(OPEN_POSITIONS[0].id);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [fileName, setFileName] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm({
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      portfolioUrl: '',
      message: ''
    }
  });

  const onSubmitForm = (data) => {
    setSubmittedData({ ...data, jobTitle: OPEN_POSITIONS.find(p => p.id === selectedJob)?.title });
    setIsSubmitSuccess(true);
    reset();
    setFileName('');
  };

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text relative pt-36 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* Universal Floating Mesh Backdrop */}
      <div className="absolute inset-0 mesh-grid opacity-35 pointer-events-none z-0" />

      {/* Decorative Orbs */}
      <div className="absolute top-1/3 -left-20 w-[450px] h-[450px] bg-primary/5 rounded-full filter blur-[150px] pointer-events-none z-0" />
      <div className="absolute bottom-1/3 -right-20 w-[450px] h-[450px] bg-primary/4 rounded-full filter blur-[150px] pointer-events-none z-0" />

      <div className="max-w-6xl mx-auto relative z-10 space-y-20">
        
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center text-primary text-[10px] font-black uppercase tracking-widest bg-primary/10 border border-primary/20 px-3 py-1 rounded-full"
          >
            Join Our Engineering & Creative Team
          </motion.span>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black font-heading text-app-text tracking-tight"
          >
            Build the Future at <span className="text-primary text-gradient-orange">Vedhunt</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm md:text-base text-app-text-muted leading-relaxed"
          >
            We are always on the lookout for exceptional developers, creative designers, and strategic marketers who are passionate about building elite, high-performance digital products.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          {/* Left Column: Job Listings */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-black font-heading text-app-text">Open Positions</h2>
              <p className="text-xs text-app-text-muted">Select a position below to apply directly.</p>
            </div>

            <div className="space-y-4">
              {OPEN_POSITIONS.map((job) => (
                <motion.div
                  key={job.id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedJob(job.id)}
                  className={`p-6 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden group ${
                    selectedJob === job.id
                      ? 'bg-app-card border-primary shadow-[0_10px_30px_rgba(232,71,10,0.15)]'
                      : 'bg-app-card/40 border-app-border hover:border-primary/30 hover:bg-app-card/80'
                  }`}
                >
                  {selectedJob === job.id && (
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                  )}

                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">
                          {job.department}
                        </span>
                        <h3 className="text-lg font-bold font-heading text-app-text mt-1.5">{job.title}</h3>
                      </div>
                      <span className="text-xs font-bold text-app-text-muted bg-white/5 border border-app-border px-3 py-1 rounded-full flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-primary" />
                        <span>{job.type}</span>
                      </span>
                    </div>

                    <p className="text-xs text-app-text-muted leading-relaxed">{job.desc}</p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-app-text-muted/80 pt-2 border-t border-app-border/50">
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
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Column: Application & Resume Upload Form */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-28 glass-panel rounded-3xl p-8 border border-primary/20 bg-app-card/85 shadow-2xl space-y-8">
              
              <div className="space-y-2 border-b border-app-border pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary block">Instant Application</span>
                <h3 className="text-xl font-bold font-heading text-app-text">Submit Your Resume</h3>
                <p className="text-xs text-app-text-muted">
                  Applying for: <strong className="text-primary">{OPEN_POSITIONS.find(p => p.id === selectedJob)?.title}</strong>
                </p>
              </div>

              <AnimatePresence mode="wait">
                {!isSubmitSuccess ? (
                  <motion.form
                    key="career-apply-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit(onSubmitForm)}
                    className="space-y-6"
                  >
                    {/* Full Name */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                        Full Name <span className="text-primary">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        className={`w-full bg-transparent border-b-2 py-2 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 ${
                          errors.fullName ? 'border-red-500/50 focus:border-red-500' : 'border-app-border/70'
                        }`}
                        {...register('fullName', { required: 'Full name is required' })}
                      />
                      {errors.fullName && (
                        <div className="flex items-center gap-1 text-[11px] text-red-500 mt-1 animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{errors.fullName.message}</span>
                        </div>
                      )}
                    </div>

                    {/* Email Address */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                        Email Address <span className="text-primary">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. rahul@example.com"
                        className={`w-full bg-transparent border-b-2 py-2 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 ${
                          errors.email ? 'border-red-500/50 focus:border-red-500' : 'border-app-border/70'
                        }`}
                        {...register('email', { 
                          required: 'Email address is required',
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Please enter a valid email address'
                          }
                        })}
                      />
                      {errors.email && (
                        <div className="flex items-center gap-1 text-[11px] text-red-500 mt-1 animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{errors.email.message}</span>
                        </div>
                      )}
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                        Phone Number <span className="text-primary">*</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. +91 98765 43210"
                        className={`w-full bg-transparent border-b-2 py-2 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 ${
                          errors.phone ? 'border-red-500/50 focus:border-red-500' : 'border-app-border/70'
                        }`}
                        {...register('phone', { required: 'Phone number is required' })}
                      />
                      {errors.phone && (
                        <div className="flex items-center gap-1 text-[11px] text-red-500 mt-1 animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{errors.phone.message}</span>
                        </div>
                      )}
                    </div>

                    {/* Portfolio / LinkedIn URL */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                        Portfolio / LinkedIn URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://linkedin.com/in/username"
                        className="w-full bg-transparent border-b-2 py-2 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 border-app-border/70"
                        {...register('portfolioUrl')}
                      />
                    </div>

                    {/* Drag & Drop Resume Upload Form */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                        Upload Resume (PDF/DOCX) <span className="text-primary">*</span>
                      </label>
                      
                      <div className="relative border-2 border-dashed border-app-border hover:border-primary/50 bg-app-bg/50 rounded-2xl p-6 text-center transition-all group cursor-pointer">
                        <input
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
                          <p className="text-[10px] text-app-text-muted">PDF, DOCX up to 10MB</p>
                        </div>
                      </div>
                    </div>

                    {/* Cover Letter / Message */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                        Cover Letter / Notes
                      </label>
                      <textarea
                        rows="2"
                        placeholder="Briefly explain why you're a great fit for this role..."
                        className="w-full bg-transparent border-b-2 py-2 text-app-text focus:outline-none focus:border-primary transition-all resize-none text-sm font-bold placeholder:text-app-text-muted/20 border-app-border/70"
                        {...register('message')}
                      />
                    </div>

                    {/* Action Button */}
                    <button
                      type="submit"
                      className="w-full py-3 bg-primary hover:bg-primary-hover text-black font-extrabold text-xs uppercase tracking-widest rounded-full transition-all duration-300 shadow-[0_10px_25px_rgba(232,71,10,0.22)] hover:shadow-[0_12px_35px_rgba(232,71,10,0.45)] hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Submit Application</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                  </motion.form>
                ) : (
                  /* Success Screen */
                  <motion.div
                    key="career-success-box"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-6 py-8"
                  >
                    <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto shadow-[0_0_35px_rgba(232,71,10,0.25)]">
                      <CheckCircle2 className="w-9 h-9 animate-bounce" />
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold font-heading text-app-text">Application Received!</h3>
                      <p className="text-xs text-app-text-muted leading-relaxed">
                        Thank you for applying, <strong className="text-app-text">{submittedData?.fullName}</strong>. Our engineering & HR leads will review your profile for the <strong className="text-primary">{submittedData?.jobTitle}</strong> position and get back to you within 48 hours.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsSubmitSuccess(false)}
                      className="px-6 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary hover:text-white rounded-full text-xs font-extrabold uppercase tracking-widest transition-all mx-auto flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Apply for Another Role</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
