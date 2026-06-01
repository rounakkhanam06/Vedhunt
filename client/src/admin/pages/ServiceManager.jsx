import { useState, useEffect } from 'react';
import { contentService } from '../../services/contentService';
import { uploadService } from '../../services/uploadService';
import { Pencil, Trash2, Search, Loader2, Plus, X, Upload, Save, Loader, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')         // Replace spaces with -
    .replace(/[^\w\-]+/g, '')     // Remove all non-word chars
    .replace(/\-\-+/g, '-')       // Replace multiple - with single -
    .replace(/^-+/, '')           // Trim - from start of text
    .replace(/-+$/, '');          // Trim - from end of text
};

const ServiceManager = ({ isNested = false }) => {
  const [services, setServices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  
  // Hero Section State
  const [isHeroOpen, setIsHeroOpen] = useState(false);
  const [heroData, setHeroData] = useState({
    badgeText: '',
    headingTop: '',
    headingHighlight: '',
    description: ''
  });
  const [isSavingHero, setIsSavingHero] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    id_string: '',
    subtitle: '',
    shortDescription: '',
    description: '',
    subServices: '',
    iconName: '',
    features: '',
    cta: 'Get Started',
    imageUrl: '',
    imagePublicId: '',
    isActive: true,
    showOnHome: true,
    showOnServicesPage: true,
  });

  const limit = 10;

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const data = await contentService.getServicesAdmin(page, limit, search);
      setServices(data.data);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [page, search]);

  useEffect(() => {
    const fetchHeroData = async () => {
      try {
        const response = await contentService.getServicesHero();
        if (response.data) {
          setHeroData({
            badgeText: response.data.badgeText || '',
            headingTop: response.data.headingTop || '',
            headingHighlight: response.data.headingHighlight || '',
            description: response.data.description || ''
          });
        }
      } catch (error) {
        console.error('Failed to fetch services hero content:', error);
      }
    };
    fetchHeroData();
  }, []);

  const handleOpenForm = (service = null) => {
    if (service) {
      const serviceData = { ...service };
      if (serviceData.features && Array.isArray(serviceData.features)) {
        serviceData.features = serviceData.features.join(', ');
      }
      setEditingService(service);
      setFormData({
        title: serviceData.title || '',
        slug: serviceData.slug || '',
        id_string: serviceData.id_string || '',
        subtitle: serviceData.subtitle || '',
        shortDescription: serviceData.shortDescription || '',
        description: serviceData.description || '',
        subServices: serviceData.subServices || '',
        iconName: serviceData.iconName || '',
        features: serviceData.features || '',
        cta: serviceData.cta || 'Get Started',
        imageUrl: serviceData.imageUrl || '',
        imagePublicId: serviceData.imagePublicId || '',
        isActive: serviceData.isActive !== undefined ? serviceData.isActive : true,
        showOnHome: serviceData.showOnHome !== undefined ? serviceData.showOnHome : true,
        showOnServicesPage: serviceData.showOnServicesPage !== undefined ? serviceData.showOnServicesPage : true,
      });
    } else {
      setEditingService(null);
      setFormData({
        title: '',
        slug: '',
        id_string: '',
        subtitle: '',
        shortDescription: '',
        description: '',
        subServices: '',
        iconName: '',
        features: '',
        cta: 'Get Started',
        imageUrl: '',
        imagePublicId: '',
        isActive: true,
        showOnHome: true,
        showOnServicesPage: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseForm = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'title' && !editingService) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        slug: generateSlug(value),
        id_string: generateSlug(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const response = await uploadService.uploadImage(file);
      setFormData(prev => ({
        ...prev,
        imageUrl: response.url,
        imagePublicId: response.publicId
      }));
    } catch (error) {
      toast.error(error.message || 'Failed to upload image');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageRemove = async () => {
    if (formData.imagePublicId) {
      try {
        await uploadService.deleteImage(formData.imagePublicId);
      } catch (error) {
        console.error('Failed to delete image from Cloudinary', error);
      }
    }
    setFormData(prev => ({
      ...prev,
      imageUrl: '',
      imagePublicId: ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const dataToSubmit = { ...formData };
      if (typeof dataToSubmit.features === 'string') {
        dataToSubmit.features = dataToSubmit.features.split('\n').filter(f => f.trim() !== '');
      }
      if (typeof dataToSubmit.subServices === 'string') {
        dataToSubmit.subServices = dataToSubmit.subServices.split('\n').filter(s => s.trim() !== '');
      }

      if (editingService) {
        await contentService.updateService(editingService._id, dataToSubmit);
        alert('Service updated successfully!');
      } else {
        await contentService.createService(dataToSubmit);
        alert('Service created successfully!');
      }
      handleCloseForm();
      fetchServices();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save service');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await contentService.deleteService(deleteTargetId);
      setDeleteTargetId(null);
      fetchServices();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete service');
      console.error(error);
    }
  };

  const handleHeroSubmit = async (e) => {
    e.preventDefault();
    setIsSavingHero(true);
    try {
      await contentService.updateServicesHero(heroData);
      toast.success('Services Hero content updated successfully!');
      setIsHeroOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update hero content');
      console.error(error);
    } finally {
      setIsSavingHero(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className={isNested ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}>
      {!isModalOpen ? (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {!isNested ? (
              <div>
                <h1 className="text-2xl font-bold text-white">Manage Services</h1>
                <p className="mt-1 text-sm text-gray-400">
                  Add, edit, or remove services offered.
                </p>
              </div>
            ) : <div />}
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search services..." 
                  className="w-full pl-9 pr-4 py-2 bg-[#1A1A1A] border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-[#FF6B00] focus:border-[#FF6B00] sm:text-sm"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Service
              </button>
            </div>
          </div>

          {/* Hero Content Manager */}
          <div className="bg-[#222222] border border-white/10 rounded-xl overflow-hidden mb-6">
            <button
              onClick={() => setIsHeroOpen(!isHeroOpen)}
              className="w-full flex items-center justify-between p-4 bg-[#1A1A1A] hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div>
                <h3 className="text-lg font-bold text-white text-left">Manage Page Hero Section</h3>
                <p className="text-sm text-gray-400 text-left">Update the top heading and description on the Services page.</p>
              </div>
              {isHeroOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            
            {isHeroOpen && (
              <div className="p-6 border-t border-white/10">
                <form onSubmit={handleHeroSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Badge Text</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                      value={heroData.badgeText}
                      onChange={(e) => setHeroData({ ...heroData, badgeText: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Heading (Main Text)</label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                        value={heroData.headingTop}
                        onChange={(e) => setHeroData({ ...heroData, headingTop: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Heading (Highlighted Text)</label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                        value={heroData.headingHighlight}
                        onChange={(e) => setHeroData({ ...heroData, headingHighlight: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                    <textarea
                      rows={3}
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                      value={heroData.description}
                      onChange={(e) => setHeroData({ ...heroData, description: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSavingHero}
                      className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingHero ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Hero Content
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <div className="bg-[#222222] shadow-xl border border-white/10 rounded-xl overflow-hidden">
            {isLoading && services.length === 0 ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#FF6B00]" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-[#1A1A1A]">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Service Title
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Slug
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#222222] divide-y divide-white/10">
                    {services.length > 0 ? services.map((service) => (
                      <tr key={service._id} className="hover:bg-white/5">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-200">
                          {service.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {service.slug}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${service.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {service.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                          <button onClick={() => handleOpenForm(service)} className="text-[#FF6B00] hover:text-[#e66000]" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(service._id)} className="text-red-500 hover:text-red-400" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                          No services found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-[#1A1A1A] px-4 py-3 border-t border-white/10 flex items-center justify-between sm:px-6">
                <div className="flex-1 flex justify-between">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium rounded-md text-gray-300 bg-[#222222] hover:bg-[#2d2d33] disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-400 self-center">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium rounded-md text-gray-300 bg-[#222222] hover:bg-[#2d2d33] disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Rebuilt Custom Page Form (Just like Hero Section!) */
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {editingService ? 'Edit Service' : 'Add New Service'}
              </h1>
              <p className="mt-1 text-sm text-gray-400">
                Fill in the details below to {editingService ? 'update the' : 'create a new'} service.
              </p>
            </div>
            <button
              onClick={handleCloseForm}
              className="px-4 py-2 border border-white/10 rounded-lg text-sm font-medium text-gray-300 bg-[#222222] hover:bg-white/5 transition-colors"
            >
              Back to Services
            </button>
          </div>

          <div className="rounded-xl bg-[#222222] p-6 shadow-xl border border-white/10">
            <form onSubmit={handleSubmit} className="space-y-5 text-left">
              {/* Title & Slug */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Title *</label>
                  <input
                    type="text"
                    name="title"
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={formData.title}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Slug *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  />
                </div>
              </div>

              {/* ID String & Subtitle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">ID String *</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={formData.id_string}
                    onChange={(e) => setFormData({ ...formData, id_string: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Subtitle</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  />
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Short Description</label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                />
              </div>

              {/* Full Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Full Description</label>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Sub Services & Lucide Icon Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Sub Services (comma separated)</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={formData.subServices}
                    onChange={(e) => setFormData({ ...formData, subServices: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Lucide Icon Name * (e.g. Globe, Smartphone)</label>
                  <input
                    type="text"
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={formData.iconName}
                    onChange={(e) => setFormData({ ...formData, iconName: e.target.value })}
                  />
                </div>
              </div>

              {/* Features & CTA Button Text */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Features (comma separated)</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={formData.features}
                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={formData.cta}
                    onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                  />
                </div>
              </div>

              {/* Image Upload Component */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Service Image</label>
                <div className="mt-1">
                  {formData.imageUrl ? (
                    <div className="relative inline-block">
                      <img src={formData.imageUrl} alt="Preview" className="h-40 rounded-lg object-cover border border-white/10" />
                      <button
                        type="button"
                        onClick={handleImageRemove}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500/95 p-1 text-white hover:bg-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex w-full items-center justify-center">
                      <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex flex-col items-center justify-center pb-6 pt-5">
                          {isUploading ? <Loader2 className="mb-2 h-8 w-8 animate-spin text-gray-400" /> : <Upload className="mb-2 h-8 w-8 text-gray-400" />}
                          <p className="text-sm text-gray-400">
                            {isUploading ? 'Uploading...' : 'Click to upload image'}
                          </p>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Visibility and Display Settings */}
              <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 space-y-4">
                <h4 className="text-sm font-semibold text-white">Display & Visibility Settings</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Status Switch */}
                  <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                    <span className="text-sm text-gray-300 font-medium">Active Status</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.isActive === true}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FF6B00] ${formData.isActive ? 'bg-[#FF6B00]' : 'bg-white/10'}`}
                      onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Show on Home Switch */}
                  <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                    <span className="text-sm text-gray-300 font-medium">Show on Homepage</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.showOnHome === true}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FF6B00] ${formData.showOnHome ? 'bg-[#FF6B00]' : 'bg-white/10'}`}
                      onClick={() => setFormData({ ...formData, showOnHome: !formData.showOnHome })}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.showOnHome ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Show on Services Page Switch */}
                  <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                    <span className="text-sm text-gray-300 font-medium">Show on Services Page</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.showOnServicesPage === true}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FF6B00] ${formData.showOnServicesPage ? 'bg-[#FF6B00]' : 'bg-white/10'}`}
                      onClick={() => setFormData({ ...formData, showOnServicesPage: !formData.showOnServicesPage })}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.showOnServicesPage ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Save Changes & Cancel Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="flex justify-center rounded-lg border border-transparent bg-[#FF6B00] px-5 py-2 text-sm font-medium text-white hover:bg-[#e66000] focus:outline-none focus:ring-2 focus:ring-[#FF6B00] disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#222222] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-6 text-left">
            <div className="flex items-center gap-4 text-red-500">
              <div className="p-3 bg-red-500/10 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Service</h3>
                <p className="text-xs text-gray-400 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-300">
              Are you sure you want to delete this service? This will permanently remove the service from both the homepage and services directory.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-white/5 border border-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium shadow-lg shadow-red-500/20 transition-colors cursor-pointer"
              >
                Delete Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceManager;
