import React, { useState, useEffect } from 'react';
import { contentService } from '../../services/contentService';
import { Save, Loader, Loader2 } from 'lucide-react';

export default function HomeServicesHeaderForm() {
  const [headerData, setHeaderData] = useState({
    tagline: '',
    heading: '',
    highlightText: '',
    description: ''
  });
  const [isHeaderLoading, setIsHeaderLoading] = useState(true);
  const [isHeaderSaving, setIsHeaderSaving] = useState(false);

  useEffect(() => {
    fetchHeaderData();
  }, []);

  const fetchHeaderData = async () => {
    try {
      setIsHeaderLoading(true);
      const response = await contentService.getHomeServicesSection();
      if (response.data) {
        setHeaderData({
          tagline: response.data.tagline || '',
          heading: response.data.heading || '',
          highlightText: response.data.highlightText || '',
          description: response.data.description || ''
        });
      }
    } catch (error) {
      alert('Failed to load home services header data');
      console.error(error);
    } finally {
      setIsHeaderLoading(false);
    }
  };

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeaderData(prev => ({ ...prev, [name]: value }));
  };

  const handleHeaderSubmit = async (e) => {
    e.preventDefault();
    setIsHeaderSaving(true);
    try {
      await contentService.updateHomeServicesSection(headerData);
      alert('Home Services Section updated successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update section');
    } finally {
      setIsHeaderSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Home Services Header</h2>
          <p className="text-gray-400 text-sm mt-1">Manage the header text for the "Our Expertise" section.</p>
        </div>
        <button
          onClick={handleHeaderSubmit}
          disabled={isHeaderSaving}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50"
        >
          {isHeaderSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isHeaderSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
        {isHeaderLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#FF6B00]" />
          </div>
        ) : (
          <form onSubmit={handleHeaderSubmit} className="space-y-6 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Tagline (Orange text)</label>
                <input
                  type="text"
                  name="tagline"
                  value={headerData.tagline}
                  onChange={handleHeaderChange}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B00] transition-colors"
                  placeholder="e.g. Our Expertise"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Highlight Text (Orange part of heading)</label>
                <input
                  type="text"
                  name="highlightText"
                  value={headerData.highlightText}
                  onChange={handleHeaderChange}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B00] transition-colors"
                  placeholder="e.g. Your Business"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Main Heading</label>
              <input
                type="text"
                name="heading"
                value={headerData.heading}
                onChange={handleHeaderChange}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B00] transition-colors"
                placeholder="e.g. Services That Fit"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Description</label>
              <textarea
                name="description"
                value={headerData.description}
                onChange={handleHeaderChange}
                rows={4}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B00] transition-colors resize-none"
                placeholder="e.g. From digital transformation to financial clarity..."
              />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
