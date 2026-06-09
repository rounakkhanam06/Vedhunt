import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, AlertCircle } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { settingsService } from '../../services/settingsService';
import toast from 'react-hot-toast';

const DPAManager = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [policyData, setPolicyData] = useState({
    hero: {
      badgeText: '',
      heading: '',
      subheading: '',
      description: ''
    },
    policyData: [],
    acceptance: {
      title: '',
      description: '',
      highlight: ''
    }
  });

  useEffect(() => {
    fetchPolicyData();
  }, []);

  const fetchPolicyData = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getDPA();
      if (res.data) {
        const dataWithIds = { ...res.data };
        if (dataWithIds.policyData && Array.isArray(dataWithIds.policyData)) {
          dataWithIds.policyData = dataWithIds.policyData.map((section, index) => ({
            ...section,
            id: section.id || `seeded-${index}-${Date.now()}`
          }));
        }
        setPolicyData(dataWithIds);
      }
    } catch (error) {
      toast.error('Failed to load DPA');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleHeroChange = (field, value) => {
    setPolicyData((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        [field]: value
      }
    }));
  };

  const handleAcceptanceChange = (field, value) => {
    setPolicyData((prev) => ({
      ...prev,
      acceptance: {
        ...prev.acceptance,
        [field]: value
      }
    }));
  };

  const handleSectionChange = (index, field, value) => {
    setPolicyData((prev) => {
      const currentSections = prev.policyData || [];
      const newSections = [...currentSections];
      newSections[index] = { ...newSections[index], [field]: value };
      return { ...prev, policyData: newSections };
    });
  };

  const addSection = () => {
    setPolicyData((prev) => ({
      ...prev,
      policyData: [
        ...(prev.policyData || []),
        { id: Date.now().toString(), title: 'New Section', content: '' }
      ]
    }));
  };

  const removeSection = (index) => {
    if (!window.confirm('Are you sure you want to remove this section?')) return;
    setPolicyData((prev) => {
      const currentSections = prev.policyData || [];
      const newSections = [...currentSections];
      newSections.splice(index, 1);
      return { ...prev, policyData: newSections };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsService.updateDPA(policyData);
      toast.success('DPA saved successfully!');
    } catch (error) {
      toast.error('Failed to save DPA');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const inputClasses = "w-full bg-[#121215] border border-[#2D2D33] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-all duration-300";
  const labelClasses = "block text-[12px] font-medium text-gray-400 mb-1.5 font-mono uppercase tracking-wider";

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  };

  if (loading) {
    return <div className="p-8 text-white">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto pb-24">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Data Processing Agreement Manager</h2>
          <p className="text-gray-400">Manage the content of the DPA page.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 bg-[#FF6B00] hover:bg-[#EA580C] text-white px-6 py-3 rounded-xl font-bold shadow-[0_4px_20px_rgba(255,107,0,0.4)] transition-all ${saving ? 'opacity-50' : 'hover:scale-105 active:scale-95'}`}
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-8">
        {/* Hero Section Editing */}
        <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            Hero Section
            <AlertCircle size={16} className="text-gray-500" />
          </h3>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClasses}>Badge Text</label>
              <input 
                type="text" 
                value={policyData.hero?.badgeText || ''} 
                onChange={(e) => handleHeroChange('badgeText', e.target.value)} 
                className={inputClasses} 
              />
            </div>
            <div>
              <label className={labelClasses}>Heading</label>
              <input 
                type="text" 
                value={policyData.hero?.heading || ''} 
                onChange={(e) => handleHeroChange('heading', e.target.value)} 
                className={inputClasses} 
              />
            </div>
            <div>
              <label className={labelClasses}>Subheading (Orange Text)</label>
              <input 
                type="text" 
                value={policyData.hero?.subheading || ''} 
                onChange={(e) => handleHeroChange('subheading', e.target.value)} 
                className={inputClasses} 
              />
            </div>
            <div className="col-span-2">
              <label className={labelClasses}>Description</label>
              <textarea 
                value={policyData.hero?.description || ''} 
                onChange={(e) => handleHeroChange('description', e.target.value)} 
                className={`${inputClasses} min-h-[100px]`} 
              />
            </div>
          </div>
        </div>

        {/* Accordion Sections Editing */}
        <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">Policy Sections (Accordion)</h3>
            <button onClick={addSection} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm transition-colors">
              <Plus size={16} /> Add Section
            </button>
          </div>

          <div className="space-y-6">
            {policyData.policyData?.map((section, idx) => (
              <div key={section.id || idx} className="bg-[#121215] border border-[#2D2D33] rounded-xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <label className={labelClasses}>Section Title</label>
                    <input 
                      type="text" 
                      value={section.title} 
                      onChange={(e) => handleSectionChange(idx, 'title', e.target.value)} 
                      className={inputClasses} 
                    />
                  </div>
                  <button onClick={() => removeSection(idx)} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg mt-6">
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <div>
                  <label className={labelClasses}>Content (Rich Text)</label>
                  <div className="bg-white rounded-lg text-black overflow-hidden">
                    <ReactQuill 
                      theme="snow" 
                      value={section.content} 
                      onChange={(value) => handleSectionChange(idx, 'content', value)}
                      modules={modules}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agreement Acceptance Editing */}
        <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Agreement Acceptance Section</h3>
          <div className="space-y-4">
            <div>
              <label className={labelClasses}>Title</label>
              <input 
                type="text" 
                value={policyData.acceptance?.title || ''} 
                onChange={(e) => handleAcceptanceChange('title', e.target.value)} 
                className={inputClasses} 
              />
            </div>
            <div>
              <label className={labelClasses}>Description Text</label>
              <textarea 
                value={policyData.acceptance?.description || ''} 
                onChange={(e) => handleAcceptanceChange('description', e.target.value)} 
                className={`${inputClasses} min-h-[80px]`} 
              />
            </div>
            <div>
              <label className={labelClasses}>Highlight Text (Bold/Primary Color)</label>
              <textarea 
                value={policyData.acceptance?.highlight || ''} 
                onChange={(e) => handleAcceptanceChange('highlight', e.target.value)} 
                className={`${inputClasses} min-h-[80px]`} 
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DPAManager;
