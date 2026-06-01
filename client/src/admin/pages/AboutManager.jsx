import { useState, useEffect } from 'react';
import { contentService } from '../../services/contentService';
import { Loader2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const AboutManager = () => {
  const [isHeroOpen, setIsHeroOpen] = useState(true);
  const [heroData, setHeroData] = useState({
    tagline: '',
    titleLine1: '',
    titleLine2: '',
    description: '',
    servicesList: '',
    ctaText: '',
    ctaLink: '',
    stat1: { value: '', labelTop: '', labelBottom: '' },
    stat2: { value: '', labelTop: '', labelBottom: '' },
  });
  const [isSavingHero, setIsSavingHero] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Company Section State
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [companyData, setCompanyData] = useState({
    tagline: '',
    headerLine1: '',
    headerLine2: '',
    centralBadge: { value: '', label1: '', label2: '' },
    descriptionParagraphs: '',
    checklistItem1: { title: '', description: '' },
    checklistItem2: { title: '', description: '' },
    signature: { name: '', role: '' }
  });
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  useEffect(() => {
    const fetchAboutData = async () => {
      try {
        const [heroResponse, companyResponse] = await Promise.all([
          contentService.getAboutHero(),
          contentService.getAboutCompany()
        ]);
        
        if (heroResponse) {
          setHeroData({
            tagline: heroResponse.tagline || '',
            titleLine1: heroResponse.titleLine1 || '',
            titleLine2: heroResponse.titleLine2 || '',
            description: heroResponse.description || '',
            servicesList: heroResponse.servicesList ? heroResponse.servicesList.join('\n') : '',
            ctaText: heroResponse.ctaText || '',
            ctaLink: heroResponse.ctaLink || '',
            stat1: heroResponse.stat1 || { value: '', labelTop: '', labelBottom: '' },
            stat2: heroResponse.stat2 || { value: '', labelTop: '', labelBottom: '' }
          });
        }

        if (companyResponse) {
          setCompanyData({
            tagline: companyResponse.tagline || '',
            headerLine1: companyResponse.headerLine1 || '',
            headerLine2: companyResponse.headerLine2 || '',
            centralBadge: companyResponse.centralBadge || { value: '', label1: '', label2: '' },
            descriptionParagraphs: companyResponse.descriptionParagraphs ? companyResponse.descriptionParagraphs.join('\n\n') : '',
            checklistItem1: companyResponse.checklistItem1 || { title: '', description: '' },
            checklistItem2: companyResponse.checklistItem2 || { title: '', description: '' },
            signature: companyResponse.signature || { name: '', role: '' }
          });
        }
      } catch (error) {
        console.error('Failed to fetch About content:', error);
        toast.error('Failed to load existing About data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAboutData();
  }, []);

  const handleHeroSubmit = async (e) => {
    e.preventDefault();
    setIsSavingHero(true);
    try {
      const dataToSubmit = {
        ...heroData,
        servicesList: typeof heroData.servicesList === 'string'
          ? heroData.servicesList.split('\n').filter(s => s.trim() !== '')
          : heroData.servicesList
      };
      await contentService.updateAboutHero(dataToSubmit);
      toast.success('About Hero content updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update hero content');
      console.error(error);
    } finally {
      setIsSavingHero(false);
    }
  };

  const handleStatChange = (statNum, field, value) => {
    setHeroData(prev => ({
      ...prev,
      [`stat${statNum}`]: {
        ...prev[`stat${statNum}`],
        [field]: value
      }
    }));
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    setIsSavingCompany(true);
    try {
      const dataToSubmit = {
        ...companyData,
        descriptionParagraphs: typeof companyData.descriptionParagraphs === 'string'
          ? companyData.descriptionParagraphs.split('\n\n').filter(s => s.trim() !== '')
          : companyData.descriptionParagraphs
      };
      await contentService.updateAboutCompany(dataToSubmit);
      toast.success('About Company content updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update company content');
      console.error(error);
    } finally {
      setIsSavingCompany(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B00]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Manage About Page</h1>
          <p className="mt-1 text-sm text-gray-400">
            Edit content sections on the About page.
          </p>
        </div>
      </div>

      {/* Hero Content Manager */}
      <div className="bg-[#222222] border border-white/10 rounded-xl overflow-hidden mb-6">
        <button
          onClick={() => setIsHeroOpen(!isHeroOpen)}
          className="w-full flex items-center justify-between p-4 bg-[#1A1A1A] hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div>
            <h3 className="text-lg font-bold text-white text-left">Hero Section</h3>
            <p className="text-sm text-gray-400 text-left">Update the top heading, description, checklist, and stats on the About page.</p>
          </div>
          {isHeroOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        
        {isHeroOpen && (
          <div className="p-6 border-t border-white/10">
            <form onSubmit={handleHeroSubmit} className="space-y-5 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tagline</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                  value={heroData.tagline}
                  onChange={(e) => setHeroData({ ...heroData, tagline: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Title Line 1</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={heroData.titleLine1}
                    onChange={(e) => setHeroData({ ...heroData, titleLine1: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Title Line 2 (Highlighted)</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={heroData.titleLine2}
                    onChange={(e) => setHeroData({ ...heroData, titleLine2: e.target.value })}
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Services Checklist (One per line)</label>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                  value={heroData.servicesList}
                  onChange={(e) => setHeroData({ ...heroData, servicesList: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={heroData.ctaText}
                    onChange={(e) => setHeroData({ ...heroData, ctaText: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">CTA Button Link</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] transition-colors"
                    value={heroData.ctaLink}
                    onChange={(e) => setHeroData({ ...heroData, ctaLink: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 space-y-4">
                <h4 className="text-sm font-semibold text-white">Stat Bubble 1 (Top Left)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Value</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={heroData.stat1.value}
                      onChange={(e) => handleStatChange(1, 'value', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Label Top</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={heroData.stat1.labelTop}
                      onChange={(e) => handleStatChange(1, 'labelTop', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Label Bottom</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={heroData.stat1.labelBottom}
                      onChange={(e) => handleStatChange(1, 'labelBottom', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 space-y-4">
                <h4 className="text-sm font-semibold text-white">Stat Bubble 2 (Bottom Right)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Value</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={heroData.stat2.value}
                      onChange={(e) => handleStatChange(2, 'value', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Label Top</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={heroData.stat2.labelTop}
                      onChange={(e) => handleStatChange(2, 'labelTop', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Label Bottom</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={heroData.stat2.labelBottom}
                      onChange={(e) => handleStatChange(2, 'labelBottom', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingHero}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#FF6B00]/20"
                >
                  {isSavingHero ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* About Company Manager */}
      <div className="bg-[#222222] border border-white/10 rounded-xl overflow-hidden mb-6">
        <button
          onClick={() => setIsCompanyOpen(!isCompanyOpen)}
          className="w-full flex items-center justify-between p-4 bg-[#1A1A1A] hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div>
            <h3 className="text-lg font-bold text-white text-left">About Our Company Section</h3>
            <p className="text-sm text-gray-400 text-left">Update the "About Our Company" description, central badge, and checklists.</p>
          </div>
          {isCompanyOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        
        {isCompanyOpen && (
          <div className="p-6 border-t border-white/10">
            <form onSubmit={handleCompanySubmit} className="space-y-5 text-left">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tagline</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                  value={companyData.tagline}
                  onChange={(e) => setCompanyData({ ...companyData, tagline: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Header Line 1</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                    value={companyData.headerLine1}
                    onChange={(e) => setCompanyData({ ...companyData, headerLine1: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Header Line 2 (Highlighted)</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                    value={companyData.headerLine2}
                    onChange={(e) => setCompanyData({ ...companyData, headerLine2: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 space-y-4">
                <h4 className="text-sm font-semibold text-white">Central Glass Badge</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Value (e.g. 5+)</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={companyData.centralBadge.value}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, centralBadge: { ...prev.centralBadge, value: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Label 1 (e.g. Years Of)</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={companyData.centralBadge.label1}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, centralBadge: { ...prev.centralBadge, label1: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Label 2 (e.g. Excellence)</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={companyData.centralBadge.label2}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, centralBadge: { ...prev.centralBadge, label2: e.target.value } }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description Paragraphs (Separate with empty line)</label>
                <div className="text-xs text-gray-400 mb-2">Use *bold* for white bold text, and **highlight** for orange bold text.</div>
                <textarea
                  rows={8}
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                  value={companyData.descriptionParagraphs}
                  onChange={(e) => setCompanyData({ ...companyData, descriptionParagraphs: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 space-y-4">
                  <h4 className="text-sm font-semibold text-white">Checklist Item 1 (Shield)</h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={companyData.checklistItem1.title}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, checklistItem1: { ...prev.checklistItem1, title: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={companyData.checklistItem1.description}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, checklistItem1: { ...prev.checklistItem1, description: e.target.value } }))}
                    />
                  </div>
                </div>

                <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 space-y-4">
                  <h4 className="text-sm font-semibold text-white">Checklist Item 2 (Award)</h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={companyData.checklistItem2.title}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, checklistItem2: { ...prev.checklistItem2, title: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={companyData.checklistItem2.description}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, checklistItem2: { ...prev.checklistItem2, description: e.target.value } }))}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#1A1A1A] p-4 rounded-xl border border-white/5 space-y-4">
                <h4 className="text-sm font-semibold text-white">Signature Block</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={companyData.signature.name}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, signature: { ...prev.signature, name: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Role / Designation</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={companyData.signature.role}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, signature: { ...prev.signature, role: e.target.value } }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingCompany}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#FF6B00]/20"
                >
                  {isSavingCompany ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AboutManager;
