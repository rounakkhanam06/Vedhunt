import { useState, useEffect } from 'react';
import { contentService } from '../../services/contentService';
import { Loader2, Save, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
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

  // Video Presentation State
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [videoData, setVideoData] = useState({
    headingLine1: '',
    headingLine2: '',
    description: '',
    checklists: '',
    videoUrl: ''
  });
  const [isSavingVideo, setIsSavingVideo] = useState(false);

  // What We Do State
  const [isWhatWeDoOpen, setIsWhatWeDoOpen] = useState(false);
  const [whatWeDoData, setWhatWeDoData] = useState({
    tagline: '',
    title: '',
    description: '',
    cards: []
  });
  const [isSavingWhatWeDo, setIsSavingWhatWeDo] = useState(false);

  // Vision Mission State
  const [isVisionMissionOpen, setIsVisionMissionOpen] = useState(false);
  const [visionMissionData, setVisionMissionData] = useState({
    visionTagline: '',
    visionTitle: '',
    visionDescription: '',
    missionTagline: '',
    missionTitle: '',
    missionDescription: ''
  });
  const [isSavingVisionMission, setIsSavingVisionMission] = useState(false);

  // Our Edge State
  const [isOurEdgeOpen, setIsOurEdgeOpen] = useState(false);
  const [ourEdgeData, setOurEdgeData] = useState({
    tagline: '',
    title: '',
    description: '',
    cards: []
  });
  const [isSavingOurEdge, setIsSavingOurEdge] = useState(false);

  useEffect(() => {
    const fetchAboutData = async () => {
      try {
        const [heroResponse, companyResponse, videoResponse, whatWeDoResponse, visionMissionResponse, ourEdgeResponse] = await Promise.all([
          contentService.getAboutHero(),
          contentService.getAboutCompany(),
          contentService.getAboutVideo(),
          contentService.getAboutWhatWeDo(),
          contentService.getAboutVisionMission(),
          contentService.getAboutOurEdge()
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

        if (videoResponse) {
          setVideoData({
            headingLine1: videoResponse.headingLine1 || '',
            headingLine2: videoResponse.headingLine2 || '',
            description: videoResponse.description || '',
            checklists: videoResponse.checklists ? videoResponse.checklists.join('\n') : '',
            videoUrl: videoResponse.videoUrl || ''
          });
        }

        if (whatWeDoResponse) {
          setWhatWeDoData({
            tagline: whatWeDoResponse.tagline || '',
            title: whatWeDoResponse.title || '',
            description: whatWeDoResponse.description || '',
            cards: whatWeDoResponse.cards || []
          });
        }

        if (visionMissionResponse) {
          setVisionMissionData({
            visionTagline: visionMissionResponse.visionTagline || '',
            visionTitle: visionMissionResponse.visionTitle || '',
            visionDescription: visionMissionResponse.visionDescription || '',
            missionTagline: visionMissionResponse.missionTagline || '',
            missionTitle: visionMissionResponse.missionTitle || '',
            missionDescription: visionMissionResponse.missionDescription || ''
          });
        }

        if (ourEdgeResponse) {
          setOurEdgeData({
            tagline: ourEdgeResponse.tagline || '',
            title: ourEdgeResponse.title || '',
            description: ourEdgeResponse.description || '',
            cards: ourEdgeResponse.cards || []
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

  const handleVideoSubmit = async (e) => {
    e.preventDefault();
    setIsSavingVideo(true);
    // Show a loading toast because fetching YT duration might take 1-2 seconds
    const loadingToast = toast.loading('Saving and fetching video duration...');
    try {
      const dataToSubmit = {
        ...videoData,
        checklists: typeof videoData.checklists === 'string'
          ? videoData.checklists.split('\n').filter(s => s.trim() !== '')
          : videoData.checklists
      };
      await contentService.updateAboutVideo(dataToSubmit);
      toast.success('Video Presentation updated successfully!', { id: loadingToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update video presentation', { id: loadingToast });
      console.error(error);
    } finally {
      setIsSavingVideo(false);
    }
  };

  const handleWhatWeDoSubmit = async (e) => {
    e.preventDefault();
    setIsSavingWhatWeDo(true);
    try {
      await contentService.updateAboutWhatWeDo(whatWeDoData);
      toast.success('What We Do section updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update What We Do section');
      console.error(error);
    } finally {
      setIsSavingWhatWeDo(false);
    }
  };

  const handleAddWhatWeDoCard = () => {
    setWhatWeDoData(prev => ({
      ...prev,
      cards: [...prev.cards, { icon: 'Code', title: '', desc: '' }]
    }));
  };

  const handleRemoveWhatWeDoCard = async (index) => {
    if (!window.confirm("Are you sure you want to delete this card? This will take effect immediately.")) return;
    
    const updatedCards = whatWeDoData.cards.filter((_, i) => i !== index);
    const newData = { ...whatWeDoData, cards: updatedCards };
    
    setWhatWeDoData(newData);
    
    try {
      setIsSavingWhatWeDo(true);
      await contentService.updateAboutWhatWeDo(newData);
      toast.success('Card deleted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete card');
      console.error(error);
    } finally {
      setIsSavingWhatWeDo(false);
    }
  };

  const handleWhatWeDoCardChange = (index, field, value) => {
    setWhatWeDoData(prev => {
      const newCards = [...prev.cards];
      newCards[index] = { ...newCards[index], [field]: value };
      return { ...prev, cards: newCards };
    });
  };

  const handleVisionMissionSubmit = async (e) => {
    e.preventDefault();
    setIsSavingVisionMission(true);
    try {
      await contentService.updateAboutVisionMission(visionMissionData);
      toast.success('Vision and Mission updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update Vision and Mission');
      console.error(error);
    } finally {
      setIsSavingVisionMission(false);
    }
  };

  const handleOurEdgeSubmit = async (e) => {
    e.preventDefault();
    setIsSavingOurEdge(true);
    try {
      await contentService.updateAboutOurEdge(ourEdgeData);
      toast.success('Our Edge section updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update Our Edge section');
      console.error(error);
    } finally {
      setIsSavingOurEdge(false);
    }
  };

  const handleAddOurEdgeCard = () => {
    setOurEdgeData(prev => ({
      ...prev,
      cards: [...prev.cards, { title: '', desc: '' }]
    }));
  };

  const handleRemoveOurEdgeCard = async (index) => {
    if (!window.confirm("Are you sure you want to delete this card? This will take effect immediately.")) return;
    
    const updatedCards = ourEdgeData.cards.filter((_, i) => i !== index);
    const newData = { ...ourEdgeData, cards: updatedCards };
    
    setOurEdgeData(newData);
    
    try {
      setIsSavingOurEdge(true);
      await contentService.updateAboutOurEdge(newData);
      toast.success('Card deleted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete card');
      console.error(error);
    } finally {
      setIsSavingOurEdge(false);
    }
  };

  const handleOurEdgeCardChange = (index, field, value) => {
    setOurEdgeData(prev => {
      const newCards = [...prev.cards];
      newCards[index] = { ...newCards[index], [field]: value };
      return { ...prev, cards: newCards };
    });
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

      {/* Video Presentation Manager */}
      <div className="bg-[#222222] border border-white/10 rounded-xl overflow-hidden mb-6">
        <button
          onClick={() => setIsVideoOpen(!isVideoOpen)}
          className="w-full flex items-center justify-between p-4 bg-[#1A1A1A] hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div>
            <h3 className="text-lg font-bold text-white text-left">Video Presentation Section</h3>
            <p className="text-sm text-gray-400 text-left">Update the headings, checklists, and YouTube embed URL. Duration is fetched automatically.</p>
          </div>
          {isVideoOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        
        {isVideoOpen && (
          <div className="p-6 border-t border-white/10">
            <form onSubmit={handleVideoSubmit} className="space-y-5 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Heading Line 1</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                    value={videoData.headingLine1}
                    onChange={(e) => setVideoData({ ...videoData, headingLine1: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Heading Line 2 (Highlighted)</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                    value={videoData.headingLine2}
                    onChange={(e) => setVideoData({ ...videoData, headingLine2: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                  value={videoData.description}
                  onChange={(e) => setVideoData({ ...videoData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Checklists (One per line, up to 4)</label>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                  value={videoData.checklists}
                  onChange={(e) => setVideoData({ ...videoData, checklists: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">YouTube Embed URL</label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/embed/hb6CFtZnj2c?autoplay=0&rel=0&modestbranding=1"
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                  value={videoData.videoUrl}
                  onChange={(e) => setVideoData({ ...videoData, videoUrl: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">Duration will be extracted automatically when you save.</p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingVideo}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#FF6B00]/20"
                >
                  {isSavingVideo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Video Section
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* What We Do Section Manager */}
      <div className="bg-[#222222] border border-white/10 rounded-xl overflow-hidden mb-6">
        <button
          onClick={() => setIsWhatWeDoOpen(!isWhatWeDoOpen)}
          className="w-full flex items-center justify-between p-4 bg-[#1A1A1A] hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div>
            <h3 className="text-lg font-bold text-white text-left">What We Do Section</h3>
            <p className="text-sm text-gray-400 text-left">Manage the section header and the grid of service cards dynamically.</p>
          </div>
          {isWhatWeDoOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        
        {isWhatWeDoOpen && (
          <div className="p-6 border-t border-white/10">
            <form onSubmit={handleWhatWeDoSubmit} className="space-y-6 text-left">
              
              <div className="space-y-4">
                <h4 className="text-md font-bold text-white border-b border-white/10 pb-2">Header Texts</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Tagline</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={whatWeDoData.tagline}
                      onChange={(e) => setWhatWeDoData({ ...whatWeDoData, tagline: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={whatWeDoData.title}
                      onChange={(e) => setWhatWeDoData({ ...whatWeDoData, title: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <textarea
                    rows={2}
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                    value={whatWeDoData.description}
                    onChange={(e) => setWhatWeDoData({ ...whatWeDoData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h4 className="text-md font-bold text-white">Service Cards ({whatWeDoData.cards.length})</h4>
                  <button
                    type="button"
                    onClick={handleAddWhatWeDoCard}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B00]/10 text-[#FF6B00] hover:bg-[#FF6B00]/20 rounded-md text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Card
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {whatWeDoData.cards.map((card, index) => (
                    <div key={index} className="bg-[#1A1A1A] border border-white/5 p-4 rounded-xl relative group">
                      <button
                        type="button"
                        onClick={() => handleRemoveWhatWeDoCard(index)}
                        className="absolute top-3 right-3 p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-md transition-colors"
                        title="Remove Card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <div className="space-y-3 pr-8">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Icon Name (lucide-react)</label>
                          <input
                            type="text"
                            placeholder="e.g. Code, Share2, Calculator"
                            className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                            value={card.icon}
                            onChange={(e) => handleWhatWeDoCardChange(index, 'icon', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                          <input
                            type="text"
                            className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                            value={card.title}
                            onChange={(e) => handleWhatWeDoCardChange(index, 'title', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                          <textarea
                            rows={2}
                            className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                            value={card.desc}
                            onChange={(e) => handleWhatWeDoCardChange(index, 'desc', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSavingWhatWeDo}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#FF6B00]/20"
                >
                  {isSavingWhatWeDo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save What We Do Section
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Vision and Mission Section Manager */}
      <div className="bg-[#222222] border border-white/10 rounded-xl overflow-hidden mb-6">
        <button
          onClick={() => setIsVisionMissionOpen(!isVisionMissionOpen)}
          className="w-full flex items-center justify-between p-4 bg-[#1A1A1A] hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div>
            <h3 className="text-lg font-bold text-white text-left">Our Vision & Mission Section</h3>
            <p className="text-sm text-gray-400 text-left">Update the Vision and Mission cards.</p>
          </div>
          {isVisionMissionOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        
        {isVisionMissionOpen && (
          <div className="p-6 border-t border-white/10">
            <form onSubmit={handleVisionMissionSubmit} className="space-y-6 text-left">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Vision Block */}
                <div className="space-y-4 bg-[#1A1A1A] p-4 rounded-xl border border-white/5">
                  <h4 className="text-md font-bold text-white border-b border-white/10 pb-2">Our Vision Card</h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Tagline</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={visionMissionData.visionTagline}
                      onChange={(e) => setVisionMissionData({ ...visionMissionData, visionTagline: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Title</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={visionMissionData.visionTitle}
                      onChange={(e) => setVisionMissionData({ ...visionMissionData, visionTitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Description</label>
                    <textarea
                      rows={3}
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={visionMissionData.visionDescription}
                      onChange={(e) => setVisionMissionData({ ...visionMissionData, visionDescription: e.target.value })}
                    />
                  </div>
                </div>

                {/* Mission Block */}
                <div className="space-y-4 bg-[#1A1A1A] p-4 rounded-xl border border-white/5">
                  <h4 className="text-md font-bold text-white border-b border-white/10 pb-2">Our Mission Card</h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Tagline</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={visionMissionData.missionTagline}
                      onChange={(e) => setVisionMissionData({ ...visionMissionData, missionTagline: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Title</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={visionMissionData.missionTitle}
                      onChange={(e) => setVisionMissionData({ ...visionMissionData, missionTitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Description</label>
                    <textarea
                      rows={3}
                      className="w-full rounded-lg border border-white/10 bg-[#222222] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={visionMissionData.missionDescription}
                      onChange={(e) => setVisionMissionData({ ...visionMissionData, missionDescription: e.target.value })}
                    />
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSavingVisionMission}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#FF6B00]/20"
                >
                  {isSavingVisionMission ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Vision & Mission
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Our Edge Section Manager */}
      <div className="bg-[#222222] border border-white/10 rounded-xl overflow-hidden mb-6">
        <button
          onClick={() => setIsOurEdgeOpen(!isOurEdgeOpen)}
          className="w-full flex items-center justify-between p-4 bg-[#1A1A1A] hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div>
            <h3 className="text-lg font-bold text-white text-left">Our Edge Section</h3>
            <p className="text-sm text-gray-400 text-left">Manage the staggered "Why Choose Us" cards dynamically.</p>
          </div>
          {isOurEdgeOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        
        {isOurEdgeOpen && (
          <div className="p-6 border-t border-white/10">
            <form onSubmit={handleOurEdgeSubmit} className="space-y-6 text-left">
              
              <div className="space-y-4">
                <h4 className="text-md font-bold text-white border-b border-white/10 pb-2">Header Texts</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Tagline</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={ourEdgeData.tagline}
                      onChange={(e) => setOurEdgeData({ ...ourEdgeData, tagline: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={ourEdgeData.title}
                      onChange={(e) => setOurEdgeData({ ...ourEdgeData, title: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <textarea
                    rows={2}
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                    value={ourEdgeData.description}
                    onChange={(e) => setOurEdgeData({ ...ourEdgeData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h4 className="text-md font-bold text-white">Staggered Cards ({ourEdgeData.cards.length})</h4>
                  <button
                    type="button"
                    onClick={handleAddOurEdgeCard}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B00]/10 text-[#FF6B00] hover:bg-[#FF6B00]/20 rounded-md text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Card
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {ourEdgeData.cards.map((card, index) => (
                    <div key={index} className="bg-[#1A1A1A] border border-white/5 p-4 rounded-xl relative group">
                      <div className="absolute top-3 left-3 bg-[#FF6B00]/10 text-[#FF6B00] font-bold px-2 py-0.5 rounded text-xs">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOurEdgeCard(index)}
                        className="absolute top-3 right-3 p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-md transition-colors"
                        title="Remove Card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <div className="space-y-3 mt-6 pr-8">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                          <input
                            type="text"
                            className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                            value={card.title}
                            onChange={(e) => handleOurEdgeCardChange(index, 'title', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                          <textarea
                            rows={2}
                            className="w-full rounded-lg border border-white/10 bg-[#222222] px-3 py-1.5 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                            value={card.desc}
                            onChange={(e) => handleOurEdgeCardChange(index, 'desc', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSavingOurEdge}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#FF6B00]/20"
                >
                  {isSavingOurEdge ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Our Edge Section
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
