import React, { useState, useEffect } from 'react';
import { Save, Loader2, X, Edit, Eye } from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import api from '../../services/api';

const ServicePagesManager = () => {
  const { token } = useAdminStore();
  const [servicePages, setServicePages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    tagline: '',
    overview: '',
    subServices: [],
    pricing: null,
    portfolio: [],
    faqs: []
  });
  const [editingSubServiceIndex, setEditingSubServiceIndex] = useState(null);
  const [subServiceForm, setSubServiceForm] = useState({ title: '', description: '', icon: 'Globe' });
  const [showSubServiceForm, setShowSubServiceForm] = useState(false);
  const [editingPricingIndex, setEditingPricingIndex] = useState(null);
  const [pricingForm, setPricingForm] = useState({
    title: '', subtitle: '', priceOneTime: '', priceSupport: '', features: '', cta: '', highlight: false
  });
  const [editingPortfolioIndex, setEditingPortfolioIndex] = useState(null);
  const [portfolioForm, setPortfolioForm] = useState({
    title: '', description: '', image: '', metric: '', appLink: '', iframeUrl: ''
  });
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [editingFaqIndex, setEditingFaqIndex] = useState(null);
  const [faqForm, setFaqForm] = useState({ q: '', a: '' });
  const [showFaqForm, setShowFaqForm] = useState(false);
  
  const [editingTestimonialIndex, setEditingTestimonialIndex] = useState(null);
  const [testimonialForm, setTestimonialForm] = useState({ feedback: '', author: '', role: '', country: '', avatar: '' });
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [globalTestimonials, setGlobalTestimonials] = useState([]);
  const [showGlobalPicker, setShowGlobalPicker] = useState(false);
  const [uploadingTestimonialImage, setUploadingTestimonialImage] = useState(false);

  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  const fetchServicePages = async () => {
    try {
      const response = await api.get('/service-pages');
      setServicePages(response.data);
    } catch (error) {
      console.error('Failed to fetch service pages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicePages();
  }, [token]);

  const handleEdit = (service) => {
    setSelectedService(service);
    setFormData({
      title: service.title || '',
      subtitle: service.subtitle || '',
      tagline: service.tagline || '',
      overview: service.overview ? service.overview.join('\n\n') : '',
      subServices: service.subServices || [],
      pricing: service.pricing || null,
      portfolio: service.portfolio || [],
      faqs: service.faqs || [],
      testimonials: (service.testimonials && service.testimonials.length > 0) 
        ? service.testimonials 
        : (service.testimonial && service.testimonial.author ? [service.testimonial] : [])
    });
    setShowSubServiceForm(false);
    setEditingSubServiceIndex(null);
    setEditingPricingIndex(null);
    setShowPortfolioForm(false);
    setEditingPortfolioIndex(null);
    setShowFaqForm(false);
    setEditingFaqIndex(null);
    setShowTestimonialForm(false);
    setShowGlobalPicker(false);
    setEditingTestimonialIndex(null);
  };

  const handleClose = () => {
    setSelectedService(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubServiceChange = (e) => {
    const { name, value } = e.target;
    setSubServiceForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSubService = () => {
    if (!subServiceForm.title.trim() || !subServiceForm.description.trim()) return;
    
    setFormData(prev => {
      const newSubServices = [...prev.subServices];
      if (editingSubServiceIndex !== null) {
        newSubServices[editingSubServiceIndex] = subServiceForm;
      } else {
        newSubServices.push(subServiceForm);
      }
      return { ...prev, subServices: newSubServices };
    });
    
    setSubServiceForm({ title: '', description: '', icon: 'Globe' });
    setShowSubServiceForm(false);
    setEditingSubServiceIndex(null);
  };

  const handleEditSubService = (index) => {
    setSubServiceForm(formData.subServices[index]);
    setEditingSubServiceIndex(index);
    setShowSubServiceForm(true);
  };

  const handleDeleteSubService = (index) => {
    setDeleteConfirmation({ type: 'subService', index });
  };

  const handlePricingToggleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        toggleLabels: {
          ...prev.pricing?.toggleLabels,
          [name]: value
        }
      }
    }));
  };

  const handlePricingFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPricingForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePortfolioFormChange = (e) => {
    const { name, value } = e.target;
    setPortfolioForm(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) {
        setPortfolioForm(prev => ({ ...prev, image: response.data.url }));
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSavePortfolio = () => {
    if (!portfolioForm.title.trim()) return;
    
    setFormData(prev => {
      const newPortfolio = [...(prev.portfolio || [])];
      if (editingPortfolioIndex !== null) {
        newPortfolio[editingPortfolioIndex] = portfolioForm;
      } else {
        newPortfolio.push(portfolioForm);
      }
      return { ...prev, portfolio: newPortfolio };
    });
    
    setPortfolioForm({ title: '', description: '', image: '', metric: '', appLink: '', iframeUrl: '' });
    setShowPortfolioForm(false);
    setEditingPortfolioIndex(null);
  };

  const handleEditPortfolio = (index) => {
    const item = formData.portfolio[index];
    setPortfolioForm({
      title: item.title || '',
      description: item.description || '',
      image: item.image || '',
      metric: item.metric || '',
      appLink: item.appLink || '',
      iframeUrl: item.iframeUrl || ''
    });
    setEditingPortfolioIndex(index);
    setShowPortfolioForm(true);
  };

  const handleDeletePortfolio = (index) => {
    setDeleteConfirmation({ type: 'portfolio', index });
  };

  const handleFaqFormChange = (e) => {
    const { name, value } = e.target;
    setFaqForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveFaq = () => {
    if (!faqForm.q.trim() || !faqForm.a.trim()) return;
    
    setFormData(prev => {
      const newFaqs = [...(prev.faqs || [])];
      if (editingFaqIndex !== null) {
        newFaqs[editingFaqIndex] = faqForm;
      } else {
        newFaqs.push(faqForm);
      }
      return { ...prev, faqs: newFaqs };
    });
    
    setFaqForm({ q: '', a: '' });
    setShowFaqForm(false);
    setEditingFaqIndex(null);
  };

  const handleEditFaq = (index) => {
    setFaqForm(formData.faqs[index]);
    setEditingFaqIndex(index);
    setShowFaqForm(true);
  };

  const handleDeleteFaq = (index) => {
    setDeleteConfirmation({ type: 'faq', index });
  };

  const confirmDelete = () => {
    if (!deleteConfirmation) return;
    const { type, index } = deleteConfirmation;
    
    setFormData(prev => {
      let newData = { ...prev };
      if (type === 'subService') {
        newData.subServices = prev.subServices.filter((_, i) => i !== index);
      } else if (type === 'portfolio') {
        newData.portfolio = prev.portfolio.filter((_, i) => i !== index);
      } else if (type === 'faq') {
        newData.faqs = prev.faqs.filter((_, i) => i !== index);
      } else if (type === 'testimonial') {
        newData.testimonials = prev.testimonials.filter((_, i) => i !== index);
      }
      return newData;
    });
    setDeleteConfirmation(null);
  };

  const fetchGlobalTestimonials = async () => {
    if (globalTestimonials.length > 0) {
      setShowGlobalPicker(!showGlobalPicker);
      setShowTestimonialForm(false);
      return;
    }
    try {
      const res = await api.get('/testimonials/approved');
      if (res.data && res.data.data) {
        setGlobalTestimonials(res.data.data);
      }
      setShowGlobalPicker(!showGlobalPicker);
      setShowTestimonialForm(false);
    } catch (err) {
      console.error('Failed to load global testimonials', err);
    }
  };

  const handleSelectGlobalTestimonial = (t) => {
    setFormData(prev => ({
      ...prev,
      testimonials: [...(prev.testimonials || []), {
        feedback: t.quote,
        author: t.author,
        role: t.role,
        country: t.country,
        avatar: t.avatar
      }]
    }));
    setShowGlobalPicker(false);
  };

  const handleTestimonialFormChange = (e) => {
    const { name, value } = e.target;
    setTestimonialForm(prev => ({ ...prev, [name]: value }));
  };

  const handleTestimonialImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingTestimonialImage(true);
    const form = new FormData();
    form.append('image', file);

    try {
      const response = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) {
        setTestimonialForm(prev => ({ ...prev, avatar: response.data.url }));
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingTestimonialImage(false);
    }
  };

  const handleSaveTestimonial = () => {
    if (!testimonialForm.feedback.trim() || !testimonialForm.author.trim()) return;
    
    setFormData(prev => {
      const newTestimonials = [...(prev.testimonials || [])];
      if (editingTestimonialIndex !== null) {
        newTestimonials[editingTestimonialIndex] = testimonialForm;
      } else {
        newTestimonials.push(testimonialForm);
      }
      return { ...prev, testimonials: newTestimonials };
    });
    
    setTestimonialForm({ feedback: '', author: '', role: '', country: '', avatar: '' });
    setShowTestimonialForm(false);
    setEditingTestimonialIndex(null);
  };

  const handleEditTestimonial = (index) => {
    setTestimonialForm(formData.testimonials[index]);
    setEditingTestimonialIndex(index);
    setShowTestimonialForm(true);
    setShowGlobalPicker(false);
  };

  const handleDeleteTestimonial = (index) => {
    setDeleteConfirmation({ type: 'testimonial', index });
  };

  const handleEditPricing = (index) => {
    const plan = formData.pricing.plans[index];
    setPricingForm({
      ...plan,
      features: plan.features ? plan.features.join('\n') : ''
    });
    setEditingPricingIndex(index);
  };

  const handleSavePricing = () => {
    setFormData(prev => {
      const newPlans = [...prev.pricing.plans];
      newPlans[editingPricingIndex] = {
        ...pricingForm,
        features: pricingForm.features.split('\n').filter(f => f.trim() !== '')
      };
      return {
        ...prev,
        pricing: { ...prev.pricing, plans: newPlans }
      };
    });
    setEditingPricingIndex(null);
  };

  const handleSave = async () => {
    if (!selectedService) return;
    
    setSaving(true);
    try {
      const updatedData = {
        title: formData.title,
        subtitle: formData.subtitle,
        tagline: formData.tagline,
        overview: formData.overview.split('\n\n').filter(p => p.trim() !== ''),
        subServices: formData.subServices,
        pricing: formData.pricing,
        portfolio: formData.portfolio,
        faqs: formData.faqs,
        testimonials: formData.testimonials
      };

      await api.put(`/service-pages/${selectedService.slug}`, updatedData);
      
      // Update local state
      setServicePages(prev => prev.map(s => s.slug === selectedService.slug ? { ...s, ...updatedData } : s));
      handleClose();
    } catch (error) {
      console.error('Failed to save service page:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-admin-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Service Subpages</h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage dynamic content for each service detail page</p>
        </div>
      </div>

      {!selectedService ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicePages.map(service => (
            <div key={service.slug} className="bg-surface-container rounded-2xl p-6 border border-outline-variant shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold text-on-surface mb-2">{service.title}</h3>
              <p className="text-sm text-on-surface-variant mb-4 line-clamp-2">{service.tagline}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleEdit(service)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-admin-primary text-on-primary rounded-xl font-medium hover:bg-admin-primary/90 transition-colors"
                >
                  <Edit size={16} /> Edit Text
                </button>
                <a
                  href={`/services/${service.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center p-2 bg-surface-variant text-on-surface rounded-xl hover:bg-surface-variant/80 transition-colors"
                  title="View Page"
                >
                  <Eye size={20} />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface-container rounded-2xl border border-outline-variant p-6 max-w-4xl">
          <div className="flex justify-between items-center mb-6 border-b border-outline-variant pb-4">
            <div>
              <h2 className="text-xl font-bold text-on-surface">Editing: {selectedService.title}</h2>
              <p className="text-sm text-on-surface-variant mt-1">Update the text content below (buttons and complex layouts are preserved).</p>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant hover:text-on-surface transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full bg-surface-variant/50 border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-admin-primary focus:ring-1 focus:ring-admin-primary outline-none transition-all"
                placeholder="e.g. Website Development"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Subtitle (Small pill text)</label>
              <input
                type="text"
                name="subtitle"
                value={formData.subtitle}
                onChange={handleChange}
                className="w-full bg-surface-variant/50 border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-admin-primary focus:ring-1 focus:ring-admin-primary outline-none transition-all"
                placeholder="e.g. High Performance & Stunning Layouts"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Tagline (Hero text)</label>
              <textarea
                name="tagline"
                value={formData.tagline}
                onChange={handleChange}
                rows={2}
                className="w-full bg-surface-variant/50 border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-admin-primary focus:ring-1 focus:ring-admin-primary outline-none transition-all resize-none"
                placeholder="Blazing-fast, SEO-optimized custom web solutions..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Overview Paragraphs</label>
              <p className="text-xs text-on-surface-variant mb-2">Separate paragraphs with a blank line (double enter).</p>
              <textarea
                name="overview"
                value={formData.overview}
                onChange={handleChange}
                rows={8}
                className="w-full bg-surface-variant/50 border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:border-admin-primary focus:ring-1 focus:ring-admin-primary outline-none transition-all"
              />
            </div>

            {/* Sub-Services Section */}
            <div className="pt-6 border-t border-outline-variant">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-medium text-on-surface">Sub-Services Matrix</h3>
                  <p className="text-xs text-on-surface-variant">Manage the capabilities cards shown below the overview.</p>
                </div>
                <button
                  onClick={() => {
                    setSubServiceForm({ title: '', description: '', icon: 'Globe' });
                    setEditingSubServiceIndex(null);
                    setShowSubServiceForm(!showSubServiceForm);
                  }}
                  className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg text-sm font-medium hover:bg-secondary-container/80 transition-colors"
                >
                  {showSubServiceForm ? 'Cancel' : 'Add Sub-Service'}
                </button>
              </div>

              {showSubServiceForm && (
                <div className="bg-surface-variant/30 p-4 rounded-xl border border-outline-variant mb-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-on-surface mb-1">Card Title</label>
                      <input
                        type="text"
                        name="title"
                        value={subServiceForm.title}
                        onChange={handleSubServiceChange}
                        className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:border-admin-primary outline-none"
                        placeholder="e.g. Landing Pages & Funnels"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface mb-1">Icon Name (Lucide React)</label>
                      <input
                        type="text"
                        name="icon"
                        value={subServiceForm.icon}
                        onChange={handleSubServiceChange}
                        className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:border-admin-primary outline-none"
                        placeholder="e.g. Globe, Smartphone, Search"
                      />
                      <p className="text-[10px] text-on-surface-variant mt-1">Visit lucide.dev for icon names.</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-on-surface mb-1">Description</label>
                    <textarea
                      name="description"
                      value={subServiceForm.description}
                      onChange={handleSubServiceChange}
                      rows={2}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:border-admin-primary outline-none resize-none"
                      placeholder="Brief description of the capability..."
                    />
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleSaveSubService} className="px-6 py-2 border-2 border-orange-500 text-orange-500 rounded-md text-sm font-medium hover:bg-orange-500 hover:text-white transition-colors">
                      {editingSubServiceIndex !== null ? 'Update Sub-Service' : 'Add Sub-Service'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.subServices.map((sub, index) => (
                  <div key={index} className="bg-surface-container p-4 rounded-xl border border-outline-variant relative group">
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditSubService(index)} className="p-1.5 bg-surface-variant rounded-md text-on-surface hover:text-admin-primary transition-colors">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDeleteSubService(index)} className="p-1.5 bg-error/10 rounded-md text-error hover:bg-error/20 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-surface-variant flex items-center justify-center text-on-surface shrink-0">
                        <span className="text-[10px] font-bold">{sub.icon?.substring(0, 2) || 'GL'}</span>
                      </div>
                      <h4 className="font-bold text-sm text-on-surface pr-16">{sub.title}</h4>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-3">{sub.description}</p>
                    <p className="text-[10px] text-admin-primary mt-2 flex items-center gap-1">Icon: {sub.icon}</p>
                  </div>
                ))}
                {formData.subServices.length === 0 && (
                  <div className="col-span-full text-center py-6 text-on-surface-variant text-sm bg-surface-variant/20 rounded-xl border border-dashed border-outline-variant">
                    No sub-services configured yet.
                  </div>
                )}
              </div>
            </div>

            {/* Pricing Section */}
            {formData.pricing && (
              <div className="pt-6 border-t border-outline-variant">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-on-surface">Pricing & Packages</h3>
                  <p className="text-xs text-on-surface-variant">Manage the pricing plans and toggle labels.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-on-surface mb-1">Primary Toggle Label</label>
                    <input
                      type="text"
                      name="primary"
                      value={formData.pricing.toggleLabels?.primary || ''}
                      onChange={handlePricingToggleChange}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:border-admin-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-on-surface mb-1">Secondary Toggle Label</label>
                    <input
                      type="text"
                      name="secondary"
                      value={formData.pricing.toggleLabels?.secondary || ''}
                      onChange={handlePricingToggleChange}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:border-admin-primary outline-none"
                    />
                  </div>
                </div>

                {editingPricingIndex !== null && (
                  <div className="bg-surface-variant/30 p-4 rounded-xl border border-outline-variant mb-4 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-sm">Editing {pricingForm.title} Plan</h4>
                      <button onClick={() => setEditingPricingIndex(null)} className="text-on-surface-variant hover:text-on-surface"><X size={16} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-on-surface mb-1">Plan Title</label>
                        <input type="text" name="title" value={pricingForm.title} onChange={handlePricingFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-on-surface mb-1">Subtitle</label>
                        <input type="text" name="subtitle" value={pricingForm.subtitle} onChange={handlePricingFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-on-surface mb-1">Primary Price (One-Time)</label>
                        <input type="text" name="priceOneTime" value={pricingForm.priceOneTime} onChange={handlePricingFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-on-surface mb-1">Secondary Price (Support)</label>
                        <input type="text" name="priceSupport" value={pricingForm.priceSupport} onChange={handlePricingFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-on-surface mb-1">Button CTA</label>
                        <input type="text" name="cta" value={pricingForm.cta} onChange={handlePricingFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" />
                      </div>
                      <div className="flex items-center gap-2 mt-6">
                        <input type="checkbox" name="highlight" checked={pricingForm.highlight} onChange={handlePricingFormChange} id="highlight-checkbox" className="w-4 h-4 rounded text-admin-primary bg-surface-container border-outline-variant" />
                        <label htmlFor="highlight-checkbox" className="text-sm font-medium text-on-surface">Highlight as "Most Popular"</label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface mb-1">Features (One per line)</label>
                      <textarea name="features" value={pricingForm.features} onChange={handlePricingFormChange} rows={6} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface resize-y" />
                    </div>
                    <div className="flex justify-end">
                      <button onClick={handleSavePricing} className="px-4 py-2 bg-admin-primary text-on-primary rounded-lg text-sm font-medium hover:bg-admin-primary/90 transition-colors">Update Plan</button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {formData.pricing.plans?.map((plan, index) => (
                    <div key={index} className={`bg-surface-container p-4 rounded-xl border relative ${plan.highlight ? 'border-admin-primary' : 'border-outline-variant'}`}>
                      {plan.highlight && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-admin-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full">MOST POPULAR</span>}
                      <button onClick={() => handleEditPricing(index)} className="absolute top-2 right-2 p-1.5 bg-surface-variant rounded-md text-on-surface hover:text-admin-primary transition-colors">
                        <Edit size={14} />
                      </button>
                      <h4 className="font-bold text-center text-lg mt-2">{plan.title}</h4>
                      <p className="text-center text-xs text-on-surface-variant italic mb-4">{plan.subtitle}</p>
                      <div className="text-center text-xl font-bold mb-4">{plan.priceOneTime}</div>
                      <ul className="text-xs space-y-2 mb-4 text-on-surface-variant">
                        {plan.features?.slice(0, 4).map((f, i) => (
                          <li key={i} className="flex gap-2"><span className="text-admin-primary shrink-0">✓</span> <span className="truncate">{f}</span></li>
                        ))}
                        {plan.features?.length > 4 && <li className="text-center italic opacity-70">+{plan.features.length - 4} more</li>}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio Section */}
            <div className="pt-6 border-t border-outline-variant">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-medium text-on-surface">Portfolio & Case Studies</h3>
                  <p className="text-xs text-on-surface-variant">Manage the case studies or app mockups.</p>
                </div>
                <button
                  onClick={() => {
                    setPortfolioForm({ title: '', description: '', image: '', metric: '', appLink: '', iframeUrl: '' });
                    setEditingPortfolioIndex(null);
                    setShowPortfolioForm(!showPortfolioForm);
                  }}
                  className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg text-sm font-medium hover:bg-secondary-container/80 transition-colors"
                >
                  {showPortfolioForm ? 'Cancel' : 'Add Case Study'}
                </button>
              </div>

              {showPortfolioForm && (
                <div className="bg-surface-variant/30 p-4 rounded-xl border border-outline-variant mb-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-on-surface mb-1">Project Title</label>
                      <input type="text" name="title" value={portfolioForm.title} onChange={handlePortfolioFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="e.g. Zenith Logistics" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface mb-1">Image Upload</label>
                      <div className="flex gap-2">
                        <input type="text" name="image" value={portfolioForm.image} onChange={handlePortfolioFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="Paste URL or upload ->" />
                        <label className={`shrink-0 flex items-center justify-center px-4 py-2 bg-surface-variant text-on-surface rounded-lg text-sm font-medium cursor-pointer hover:bg-surface-variant/80 transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                          {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload'}
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface mb-1">Highlight Metric Pill</label>
                      <input type="text" name="metric" value={portfolioForm.metric} onChange={handlePortfolioFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="e.g. 180% PAGESPEED INCREASE" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface mb-1">App/Demo Link (Used in App Dev)</label>
                      <input type="text" name="appLink" value={portfolioForm.appLink} onChange={handlePortfolioFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="https://..." />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-on-surface mb-1">Iframe/Mockup URL (Used in App Dev)</label>
                      <input type="text" name="iframeUrl" value={portfolioForm.iframeUrl} onChange={handlePortfolioFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="https://..." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-on-surface mb-1">Description</label>
                    <textarea name="description" value={portfolioForm.description} onChange={handlePortfolioFormChange} rows={3} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface resize-none" placeholder="Brief description of the project..." />
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleSavePortfolio} className="px-6 py-2 border-2 border-orange-500 text-orange-500 rounded-md text-sm font-medium hover:bg-orange-500 hover:text-white transition-colors">
                      {editingPortfolioIndex !== null ? 'Update Case Study' : 'Add Case Study'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.portfolio?.map((item, index) => (
                  <div key={index} className="bg-surface-container p-4 rounded-xl border border-outline-variant relative group flex flex-col sm:flex-row gap-4">
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={() => handleEditPortfolio(index)} className="p-1.5 bg-surface-variant rounded-md text-on-surface hover:text-admin-primary transition-colors">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDeletePortfolio(index)} className="p-1.5 bg-error/10 rounded-md text-error hover:bg-error/20 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="w-full sm:w-24 h-24 bg-surface-variant rounded-lg shrink-0 overflow-hidden relative">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-on-surface-variant">No Image</div>
                      )}
                    </div>
                    <div>
                      {item.metric && <span className="inline-block px-2 py-0.5 rounded border border-admin-primary/30 text-[10px] font-bold text-admin-primary mb-1">{item.metric}</span>}
                      <h4 className="font-bold text-sm text-on-surface mb-1">{item.title}</h4>
                      <p className="text-xs text-on-surface-variant line-clamp-2">{item.description}</p>
                      {item.appLink && <a href={item.appLink} target="_blank" rel="noreferrer" className="inline-block mt-2 text-[10px] text-admin-primary hover:underline">App Link &rarr;</a>}
                    </div>
                  </div>
                ))}
                {(!formData.portfolio || formData.portfolio.length === 0) && (
                  <div className="col-span-full text-center py-6 text-on-surface-variant text-sm bg-surface-variant/20 rounded-xl border border-dashed border-outline-variant">
                    No portfolio items configured yet.
                  </div>
                )}
              </div>
            </div>

            {/* FAQs Section */}
            <div className="pt-6 border-t border-outline-variant">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-medium text-on-surface">Frequently Asked Questions</h3>
                  <p className="text-xs text-on-surface-variant">Manage the FAQs displayed at the bottom of the page.</p>
                </div>
                <button
                  onClick={() => {
                    setFaqForm({ q: '', a: '' });
                    setEditingFaqIndex(null);
                    setShowFaqForm(!showFaqForm);
                  }}
                  className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg text-sm font-medium hover:bg-secondary-container/80 transition-colors"
                >
                  {showFaqForm ? 'Cancel' : 'Add FAQ'}
                </button>
              </div>

              {showFaqForm && (
                <div className="bg-surface-variant/30 p-4 rounded-xl border border-outline-variant mb-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-on-surface mb-1">Question</label>
                    <input type="text" name="q" value={faqForm.q} onChange={handleFaqFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="e.g. Do you offer support after launch?" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-on-surface mb-1">Answer</label>
                    <textarea name="a" value={faqForm.a} onChange={handleFaqFormChange} rows={4} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface resize-y" placeholder="Yes, we provide 3 months of free post-launch support..." />
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleSaveFaq} className="px-6 py-2 border-2 border-orange-500 text-orange-500 rounded-md text-sm font-medium hover:bg-orange-500 hover:text-white transition-colors">
                      {editingFaqIndex !== null ? 'Update FAQ' : 'Add FAQ'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {formData.faqs?.map((faq, index) => (
                  <div key={index} className="bg-surface-container p-4 rounded-xl border border-outline-variant relative group">
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditFaq(index)} className="p-1.5 bg-surface-variant rounded-md text-on-surface hover:text-admin-primary transition-colors">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDeleteFaq(index)} className="p-1.5 bg-error/10 rounded-md text-error hover:bg-error/20 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <h4 className="font-bold text-sm text-on-surface mb-2 pr-16">{faq.q}</h4>
                    <p className="text-xs text-on-surface-variant">{faq.a}</p>
                  </div>
                ))}
                {(!formData.faqs || formData.faqs.length === 0) && (
                  <div className="text-center py-6 text-on-surface-variant text-sm bg-surface-variant/20 rounded-xl border border-dashed border-outline-variant">
                    No FAQs configured yet.
                  </div>
                )}
              </div>
            </div>

            {/* Testimonials Section */}
            <div className="pt-6 border-t border-outline-variant">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-medium text-on-surface">Testimonials</h3>
                  <p className="text-xs text-on-surface-variant">Manage client reviews for this service page. Multiple reviews will show as a carousel.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={fetchGlobalTestimonials}
                    className="px-4 py-2 bg-surface-variant text-on-surface rounded-lg text-sm font-medium hover:bg-surface-variant/80 transition-colors"
                  >
                    Import Existing
                  </button>
                  <button
                    onClick={() => {
                      setTestimonialForm({ feedback: '', author: '', role: '', country: '', avatar: '' });
                      setEditingTestimonialIndex(null);
                      setShowTestimonialForm(!showTestimonialForm);
                      setShowGlobalPicker(false);
                    }}
                    className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-lg text-sm font-medium hover:bg-secondary-container/80 transition-colors"
                  >
                    {showTestimonialForm ? 'Cancel' : 'Add Custom'}
                  </button>
                </div>
              </div>

              {showGlobalPicker && (
                <div className="bg-surface-variant/30 p-4 rounded-xl border border-outline-variant mb-4">
                  <h4 className="text-sm font-bold text-on-surface mb-3">Select from Global Testimonials</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {globalTestimonials.map((t, idx) => (
                      <div key={idx} onClick={() => handleSelectGlobalTestimonial(t)} className="bg-surface-container border border-outline-variant rounded-lg p-3 cursor-pointer hover:border-admin-primary hover:bg-admin-primary/5 transition-all">
                        <div className="flex items-center gap-3 mb-2">
                          <img src={t.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          <div>
                            <p className="text-xs font-bold text-on-surface">{t.author}</p>
                            <p className="text-[10px] text-on-surface-variant">{t.role} • {t.country}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-on-surface-variant line-clamp-3 italic">"{t.quote}"</p>
                      </div>
                    ))}
                    {globalTestimonials.length === 0 && <p className="text-xs text-on-surface-variant col-span-full">No approved testimonials found.</p>}
                  </div>
                </div>
              )}

              {showTestimonialForm && (
                <div className="bg-surface-variant/30 p-4 rounded-xl border border-outline-variant mb-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-on-surface mb-1">Author Name</label>
                      <input type="text" name="author" value={testimonialForm.author} onChange={handleTestimonialFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="e.g. John Doe" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface mb-1">Role / Company</label>
                      <input type="text" name="role" value={testimonialForm.role} onChange={handleTestimonialFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="e.g. CEO, TechCorp" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface mb-1">Country</label>
                      <input type="text" name="country" value={testimonialForm.country} onChange={handleTestimonialFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="e.g. India" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface mb-1">Avatar Upload</label>
                      <div className="flex gap-2">
                        <input type="text" name="avatar" value={testimonialForm.avatar} onChange={handleTestimonialFormChange} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface" placeholder="Paste URL or upload ->" />
                        <label className={`shrink-0 flex items-center justify-center px-4 py-2 bg-surface-variant text-on-surface rounded-lg text-sm font-medium cursor-pointer hover:bg-surface-variant/80 transition-colors ${uploadingTestimonialImage ? 'opacity-50 pointer-events-none' : ''}`}>
                          {uploadingTestimonialImage ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload'}
                          <input type="file" className="hidden" accept="image/*" onChange={handleTestimonialImageUpload} disabled={uploadingTestimonialImage} />
                        </label>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-on-surface mb-1">Feedback / Quote</label>
                      <textarea name="feedback" value={testimonialForm.feedback} onChange={handleTestimonialFormChange} rows={3} className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface resize-y" placeholder="Client's review..." />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleSaveTestimonial} className="px-6 py-2 border-2 border-orange-500 text-orange-500 rounded-md text-sm font-medium hover:bg-orange-500 hover:text-white transition-colors">
                      {editingTestimonialIndex !== null ? 'Update Testimonial' : 'Save Custom Testimonial'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {formData.testimonials?.map((t, index) => (
                  <div key={index} className="bg-surface-container p-4 rounded-xl border border-outline-variant relative group flex items-center gap-4">
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={() => handleEditTestimonial(index)} className="p-1.5 bg-surface-variant rounded-md text-on-surface hover:text-admin-primary transition-colors">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDeleteTestimonial(index)} className="p-1.5 bg-error/10 rounded-md text-error hover:bg-error/20 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <img src={t.avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 bg-surface-variant" />
                    <div>
                      <p className="text-xs font-bold text-on-surface">{t.author} <span className="font-normal text-on-surface-variant ml-1">({t.role})</span></p>
                      <p className="text-[10px] text-on-surface-variant mb-1">{t.country || 'No Country'}</p>
                      <p className="text-[11px] text-on-surface-variant italic line-clamp-2">"{t.feedback}"</p>
                    </div>
                  </div>
                ))}
                {(!formData.testimonials || formData.testimonials.length === 0) && (
                  <div className="text-center py-6 text-on-surface-variant text-sm bg-surface-variant/20 rounded-xl border border-dashed border-outline-variant">
                    No testimonials configured yet.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
              <button
                onClick={handleClose}
                className="px-6 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-variant transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-admin-primary text-on-primary rounded-xl hover:bg-admin-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-outline-variant p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-on-surface mb-2">Confirm Deletion</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              Are you sure you want to delete this item? This action cannot be undone unless you cancel your unsaved changes.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 bg-surface-variant text-on-surface rounded-lg text-sm font-medium hover:bg-surface-variant/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-error text-on-error rounded-lg text-sm font-medium hover:bg-error/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicePagesManager;
