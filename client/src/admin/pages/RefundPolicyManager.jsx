import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, AlertCircle } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { settingsService } from '../../services/settingsService';
import toast from 'react-hot-toast';

const RefundPolicyManager = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [policyData, setPolicyData] = useState({
    hero: { heading: '', lastUpdated: '', subtitle: '', paragraphs: [] },
    scope: { title: '', intro: '', items: [] },
    billingTerms: { title: '', items: [] },
    noRefund: { 
      title: '', subtitle: '', intro1: '', intro2: '', noRefundItems: [], 
      commitment: { title: '', items: [], footer: '' } 
    },
    cancellation: { title: '', intro: '', items: [] }
  });

  useEffect(() => {
    fetchPolicyData();
  }, []);

  const fetchPolicyData = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getRefundPolicy();
      if (res.data) setPolicyData(res.data);
    } catch (error) {
      toast.error('Failed to load Refund Policy');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsService.updateRefundPolicy(policyData);
      toast.success('Refund Policy saved successfully!');
    } catch (error) {
      toast.error('Failed to save Refund Policy');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const updateNestedState = (section, field, value) => {
    setPolicyData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  const updateArrayItem = (section, arrayField, index, value) => {
    setPolicyData((prev) => {
      const arr = [...prev[section][arrayField]];
      arr[index] = value;
      return { ...prev, [section]: { ...prev[section], [arrayField]: arr } };
    });
  };

  const addArrayItem = (section, arrayField, defaultValue = '') => {
    setPolicyData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [arrayField]: [...prev[section][arrayField], defaultValue] }
    }));
  };

  const removeArrayItem = (section, arrayField, index) => {
    setPolicyData((prev) => {
      const arr = [...prev[section][arrayField]];
      arr.splice(index, 1);
      return { ...prev, [section]: { ...prev[section], [arrayField]: arr } };
    });
  };

  const inputClasses = "w-full bg-[#121215] border border-[#2D2D33] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition-all duration-300";
  const labelClasses = "block text-[12px] font-medium text-gray-400 mb-1.5 font-mono uppercase tracking-wider";

  if (loading) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto pb-24">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Refund & Billing Policy Manager</h2>
          <p className="text-gray-400">Manage the content of the Refund Policy page.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 bg-[#FF6B00] hover:bg-[#EA580C] text-white px-6 py-3 rounded-xl font-bold transition-all ${saving ? 'opacity-50' : 'hover:scale-105 active:scale-95'}`}
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-8">
        {/* HERO SECTION */}
        <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Hero Section</h3>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClasses}>Heading</label>
              <input type="text" value={policyData.hero?.heading || ''} onChange={(e) => updateNestedState('hero', 'heading', e.target.value)} className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>Last Updated</label>
              <input type="text" value={policyData.hero?.lastUpdated || ''} onChange={(e) => updateNestedState('hero', 'lastUpdated', e.target.value)} className={inputClasses} />
            </div>
            <div className="col-span-2">
              <label className={labelClasses}>Subtitle</label>
              <input type="text" value={policyData.hero?.subtitle || ''} onChange={(e) => updateNestedState('hero', 'subtitle', e.target.value)} className={inputClasses} />
            </div>
          </div>
          <div>
            <label className={labelClasses}>Intro Paragraphs</label>
            {policyData.hero?.paragraphs?.map((p, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <textarea value={p} onChange={(e) => updateArrayItem('hero', 'paragraphs', idx, e.target.value)} className={`${inputClasses} min-h-[60px]`} />
                <button onClick={() => removeArrayItem('hero', 'paragraphs', idx)} className="p-2 bg-red-500/10 text-red-500 rounded-lg h-fit mt-1"><Trash2 size={16} /></button>
              </div>
            ))}
            <button onClick={() => addArrayItem('hero', 'paragraphs')} className="text-sm text-primary flex items-center gap-1 mt-2 hover:underline"><Plus size={14} /> Add Paragraph</button>
          </div>
        </div>

        {/* SECTION 1: SCOPE */}
        <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Section 1: Scope</h3>
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <label className={labelClasses}>Section Title</label>
              <input type="text" value={policyData.scope?.title || ''} onChange={(e) => updateNestedState('scope', 'title', e.target.value)} className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>Intro Text</label>
              <input type="text" value={policyData.scope?.intro || ''} onChange={(e) => updateNestedState('scope', 'intro', e.target.value)} className={inputClasses} />
            </div>
          </div>
          <div>
            <label className={labelClasses}>Scope Items (Bullet points)</label>
            {policyData.scope?.items?.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input type="text" value={item} onChange={(e) => updateArrayItem('scope', 'items', idx, e.target.value)} className={inputClasses} />
                <button onClick={() => removeArrayItem('scope', 'items', idx)} className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={16} /></button>
              </div>
            ))}
            <button onClick={() => addArrayItem('scope', 'items')} className="text-sm text-primary flex items-center gap-1 mt-2 hover:underline"><Plus size={14} /> Add Scope Item</button>
          </div>
        </div>

        {/* SECTION 2: BILLING TERMS */}
        <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Section 2: Billing Terms (Accordion)</h3>
          <div className="mb-6">
            <label className={labelClasses}>Section Title</label>
            <input type="text" value={policyData.billingTerms?.title || ''} onChange={(e) => updateNestedState('billingTerms', 'title', e.target.value)} className={inputClasses} />
          </div>
          <div className="space-y-4">
            {policyData.billingTerms?.items?.map((item, idx) => (
              <div key={idx} className="bg-[#121215] border border-[#2D2D33] rounded-xl p-4">
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <label className={labelClasses}>Accordion Title</label>
                    <input type="text" value={item.title} onChange={(e) => {
                      const newItems = [...policyData.billingTerms.items];
                      newItems[idx].title = e.target.value;
                      updateNestedState('billingTerms', 'items', newItems);
                    }} className={inputClasses} />
                  </div>
                  <button onClick={() => removeArrayItem('billingTerms', 'items', idx)} className="p-2 bg-red-500/10 text-red-500 rounded-lg h-fit mt-6"><Trash2 size={16} /></button>
                </div>
                <div>
                  <label className={labelClasses}>Content (Rich Text)</label>
                  <div className="bg-white rounded-lg text-black overflow-hidden">
                    <ReactQuill theme="snow" value={item.content} onChange={(val) => {
                      const newItems = [...policyData.billingTerms.items];
                      newItems[idx].content = val;
                      updateNestedState('billingTerms', 'items', newItems);
                    }} />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => addArrayItem('billingTerms', 'items', { title: 'New Term', content: '' })} className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"><Plus size={14} /> Add Billing Term</button>
          </div>
        </div>

        {/* SECTION 3: NO REFUND POLICY */}
        <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Section 3: No Refund Policy</h3>
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <label className={labelClasses}>Section Title</label>
              <input type="text" value={policyData.noRefund?.title || ''} onChange={(e) => updateNestedState('noRefund', 'title', e.target.value)} className={inputClasses} />
            </div>
            <div className="col-span-2">
              <label className={labelClasses}>Subtitle (Bold)</label>
              <input type="text" value={policyData.noRefund?.subtitle || ''} onChange={(e) => updateNestedState('noRefund', 'subtitle', e.target.value)} className={inputClasses} />
            </div>
            <div className="col-span-2">
              <label className={labelClasses}>Intro Text 1</label>
              <textarea value={policyData.noRefund?.intro1 || ''} onChange={(e) => updateNestedState('noRefund', 'intro1', e.target.value)} className={`${inputClasses} min-h-[60px]`} />
            </div>
            <div className="col-span-2">
              <label className={labelClasses}>Intro Text 2 ("We do not offer refunds for:")</label>
              <input type="text" value={policyData.noRefund?.intro2 || ''} onChange={(e) => updateNestedState('noRefund', 'intro2', e.target.value)} className={inputClasses} />
            </div>
          </div>
          <div className="mb-8">
            <label className={labelClasses}>No Refund Items (Red Cross List)</label>
            {policyData.noRefund?.noRefundItems?.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input type="text" value={item} onChange={(e) => updateArrayItem('noRefund', 'noRefundItems', idx, e.target.value)} className={inputClasses} />
                <button onClick={() => removeArrayItem('noRefund', 'noRefundItems', idx)} className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={16} /></button>
              </div>
            ))}
            <button onClick={() => addArrayItem('noRefund', 'noRefundItems')} className="text-sm text-primary flex items-center gap-1 mt-2 hover:underline"><Plus size={14} /> Add Item</button>
          </div>

          <div className="p-4 border border-primary/30 bg-primary/5 rounded-xl space-y-4">
            <h4 className="font-bold text-white mb-2">Our Commitment Box</h4>
            <div>
              <label className={labelClasses}>Title</label>
              <input type="text" value={policyData.noRefund?.commitment?.title || ''} onChange={(e) => {
                setPolicyData(prev => ({...prev, noRefund: {...prev.noRefund, commitment: {...prev.noRefund.commitment, title: e.target.value}}}));
              }} className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>Commitment Items (Green Check List)</label>
              {policyData.noRefund?.commitment?.items?.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input type="text" value={item} onChange={(e) => {
                    const arr = [...policyData.noRefund.commitment.items];
                    arr[idx] = e.target.value;
                    setPolicyData(prev => ({...prev, noRefund: {...prev.noRefund, commitment: {...prev.noRefund.commitment, items: arr}}}));
                  }} className={inputClasses} />
                  <button onClick={() => {
                     const arr = [...policyData.noRefund.commitment.items];
                     arr.splice(idx, 1);
                     setPolicyData(prev => ({...prev, noRefund: {...prev.noRefund, commitment: {...prev.noRefund.commitment, items: arr}}}));
                  }} className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={16} /></button>
                </div>
              ))}
              <button onClick={() => {
                const arr = [...(policyData.noRefund?.commitment?.items || []), ''];
                setPolicyData(prev => ({...prev, noRefund: {...prev.noRefund, commitment: {...prev.noRefund.commitment, items: arr}}}));
              }} className="text-sm text-primary flex items-center gap-1 mt-2 hover:underline"><Plus size={14} /> Add Commitment Item</button>
            </div>
            <div>
              <label className={labelClasses}>Footer Text</label>
              <input type="text" value={policyData.noRefund?.commitment?.footer || ''} onChange={(e) => {
                setPolicyData(prev => ({...prev, noRefund: {...prev.noRefund, commitment: {...prev.noRefund.commitment, footer: e.target.value}}}));
              }} className={inputClasses} />
            </div>
          </div>
        </div>

        {/* SECTION 4: PROJECT CANCELLATION */}
        <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-6">Section 4: Project Cancellation</h3>
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
              <label className={labelClasses}>Section Title</label>
              <input type="text" value={policyData.cancellation?.title || ''} onChange={(e) => updateNestedState('cancellation', 'title', e.target.value)} className={inputClasses} />
            </div>
            <div className="col-span-2">
              <label className={labelClasses}>Intro Text</label>
              <textarea value={policyData.cancellation?.intro || ''} onChange={(e) => updateNestedState('cancellation', 'intro', e.target.value)} className={`${inputClasses} min-h-[60px]`} />
            </div>
          </div>
          <div>
            <label className={labelClasses}>Cancellation Items (Bullet points)</label>
            {policyData.cancellation?.items?.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input type="text" value={item} onChange={(e) => updateArrayItem('cancellation', 'items', idx, e.target.value)} className={inputClasses} />
                <button onClick={() => removeArrayItem('cancellation', 'items', idx)} className="p-2 bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={16} /></button>
              </div>
            ))}
            <button onClick={() => addArrayItem('cancellation', 'items')} className="text-sm text-primary flex items-center gap-1 mt-2 hover:underline"><Plus size={14} /> Add Cancellation Item</button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RefundPolicyManager;
