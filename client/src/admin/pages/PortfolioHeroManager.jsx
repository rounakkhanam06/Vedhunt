import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PortfolioHeroManager({ isNested }) {
  const [formData, setFormData] = useState({
    subtitle: '',
    headingRegular: '',
    headingHighlight: '',
    description: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchHeroData();
  }, []);

  const fetchHeroData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/portfolio/hero');
      if (res.data.success && res.data.data) {
        setFormData({
          subtitle: res.data.data.subtitle || '',
          headingRegular: res.data.data.headingRegular || '',
          headingHighlight: res.data.data.headingHighlight || '',
          description: res.data.data.description || ''
        });
      }
    } catch (error) {
      toast.error('Failed to load Hero section data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await api.put('/portfolio/admin/hero', formData);
      toast.success('Hero section updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update Hero section');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const Content = (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 md:p-8">
      <div className="mb-8 pb-4 border-b border-white/10">
        <h2 className="text-2xl font-bold text-white">Hero Section</h2>
        <p className="text-gray-400 text-sm mt-1">
          Manage the text displayed in the Hero section at the top of the Portfolio page.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-sm font-medium text-gray-300 block mb-2">Subtitle Accent *</label>
          <input
            required
            type="text"
            value={formData.subtitle}
            onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
            placeholder="e.g. Success Showcases"
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
          />
          <p className="text-xs text-gray-500 mt-1">This appears as the small highlighted badge above the main heading.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Heading (Regular Text) *</label>
            <input
              required
              type="text"
              value={formData.headingRegular}
              onChange={(e) => setFormData({ ...formData, headingRegular: e.target.value })}
              placeholder="e.g. Proven Engineering Standards"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Heading (Highlighted Text) *</label>
            <input
              required
              type="text"
              value={formData.headingHighlight}
              onChange={(e) => setFormData({ ...formData, headingHighlight: e.target.value })}
              placeholder="e.g. & Strategic Growth"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-gray-500 mt-1">This portion of the heading will have an orange gradient.</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-300 block mb-2">Description Paragraph *</label>
          <textarea
            required
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Explore our real-world portfolio..."
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <div className="pt-4 border-t border-white/10 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-2.5 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Hero Section</>}
          </button>
        </div>
      </form>
    </div>
  );

  if (isNested) {
    return Content;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio Page Content</h1>
          <p className="text-gray-400 text-sm mt-1">Manage the sections of your portfolio page.</p>
        </div>
      </div>
      {Content}
    </div>
  );
}
