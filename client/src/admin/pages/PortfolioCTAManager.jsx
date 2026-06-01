import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader, Sparkles, Laptop, Zap, Share2, Database, Save, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PortfolioCTAManager({ isNested = false }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [ctaData, setCtaData] = useState({
    tagText: "Let's Collaborate",
    tagIcon: 'Sparkles',
    headingRegular: 'Ready to Build Your',
    headingHighlight: 'Digital Legacy?',
    buttonText: 'Start a Project',
    buttonLink: '/get-quote',
    features: [
      { text: 'Free Visual Mockup Draft', icon: 'Sparkles' },
      { text: 'Direct Engineering Channel', icon: 'Laptop' },
      { text: 'High-Performance Launch', icon: 'Zap' }
    ]
  });

  useEffect(() => {
    fetchCTAData();
  }, []);

  const fetchCTAData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/portfolio/cta');
      if (res.data.data) {
        setCtaData(res.data.data);
      }
    } catch (error) {
      toast.error('Failed to load CTA data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put('/portfolio/admin/cta', ctaData);
      toast.success('CTA Section updated successfully!');
      fetchCTAData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update CTA');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFeatureChange = (index, field, value) => {
    const newFeatures = [...ctaData.features];
    newFeatures[index][field] = value;
    setCtaData({ ...ctaData, features: newFeatures });
  };

  const addFeature = () => {
    if (ctaData.features.length >= 3) {
      toast.error('Maximum 3 features allowed for optimal design');
      return;
    }
    setCtaData({
      ...ctaData,
      features: [...ctaData.features, { text: '', icon: 'Sparkles' }]
    });
  };

  const removeFeature = (index) => {
    const newFeatures = ctaData.features.filter((_, i) => i !== index);
    setCtaData({ ...ctaData, features: newFeatures });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const content = (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8 max-w-4xl mx-auto">
      <div className="mb-8 pb-4 border-b border-white/10">
        <h2 className="text-2xl font-bold text-white">Call to Action (CTA) Section</h2>
        <p className="text-gray-400 text-sm mt-1">Manage the bottom banner on the portfolio page.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        
        {/* Main Content Section */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white/90 border-b border-white/10 pb-2">Main Content</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Tag Text</label>
              <input
                required
                type="text"
                value={ctaData.tagText}
                onChange={e => setCtaData({ ...ctaData, tagText: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Tag Icon</label>
              <select
                value={ctaData.tagIcon}
                onChange={e => setCtaData({ ...ctaData, tagIcon: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              >
                <option value="Sparkles">Sparkles</option>
                <option value="Laptop">Laptop</option>
                <option value="Zap">Zap</option>
                <option value="Share2">Share2</option>
                <option value="Database">Database</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Heading (Regular Text)</label>
              <input
                required
                type="text"
                value={ctaData.headingRegular}
                onChange={e => setCtaData({ ...ctaData, headingRegular: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Heading (Highlighted Text)</label>
              <input
                required
                type="text"
                value={ctaData.headingHighlight}
                onChange={e => setCtaData({ ...ctaData, headingHighlight: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Button Section */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white/90 border-b border-white/10 pb-2">Button Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Button Text</label>
              <input
                required
                type="text"
                value={ctaData.buttonText}
                onChange={e => setCtaData({ ...ctaData, buttonText: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Button Link URL</label>
              <input
                required
                type="text"
                value={ctaData.buttonLink}
                onChange={e => setCtaData({ ...ctaData, buttonLink: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-lg font-semibold text-white/90">Feature Cards (Max 3)</h3>
            {ctaData.features.length < 3 && (
              <button
                type="button"
                onClick={addFeature}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary hover:bg-primary/30 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Feature
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            {ctaData.features.map((feature, index) => (
              <div key={index} className="flex gap-4 items-start bg-black/30 p-4 rounded-lg border border-white/5 relative group">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-400 block mb-1">Feature Text</label>
                  <input
                    required
                    type="text"
                    value={feature.text}
                    onChange={e => handleFeatureChange(index, 'text', e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="w-48">
                  <label className="text-xs font-medium text-gray-400 block mb-1">Icon</label>
                  <select
                    value={feature.icon}
                    onChange={e => handleFeatureChange(index, 'icon', e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="Sparkles">Sparkles</option>
                    <option value="Laptop">Laptop</option>
                    <option value="Zap">Zap</option>
                    <option value="Share2">Share2</option>
                    <option value="Database">Database</option>
                  </select>
                </div>
                {ctaData.features.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFeature(index)}
                    className="mt-6 p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove Feature"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-white/10">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-2.5 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> Save CTA</>}
          </button>
        </div>
      </form>
    </div>
  );

  if (isNested) {
    return content;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio CTA Management</h1>
          <p className="text-gray-400 text-sm mt-1">Manage the call-to-action section on the portfolio page.</p>
        </div>
      </div>
      {content}
    </div>
  );
}
