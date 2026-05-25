import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';
import axios from 'axios';

export default function ReviewModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    author: '',
    role: '',
    country: '',
    countryFlag: '',
    quote: '',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&h=150&fit=crop'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const WORD_LIMIT = 100;

  const countWords = (str) => {
    return str.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const wordCount = countWords(formData.quote);

  if (!isOpen) return null;

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = new FormData();
    data.append('image', file);

    setIsUploading(true);
    setError('');
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const res = await axios.post(`${apiUrl}/upload/public`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.url) {
        setFormData({ ...formData, avatar: res.data.url });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (wordCount > WORD_LIMIT) {
      setError(`Your review exceeds the ${WORD_LIMIT} word limit. Please shorten it.`);
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      await axios.post(`${apiUrl}/testimonials`, formData);
      setIsSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setFormData({ 
      author: '', 
      role: '', 
      country: '', 
      countryFlag: '', 
      quote: '',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&h=150&fit=crop'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-app-card rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-white/10 relative">
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 md:p-8">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Write a Review</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400 mb-6">
            Share your experience with Vedhunt. Your review will be published after approval.
          </p>

          {isSuccess ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Thank You!</h4>
              <p className="text-slate-600 dark:text-gray-400">
                Your review has been submitted successfully and is currently pending approval.
              </p>
              <button 
                onClick={handleClose}
                className="mt-6 px-6 py-2 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-100 border border-red-200 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({...formData, author: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-primary dark:text-white"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Designation</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-primary dark:text-white"
                    placeholder="CEO at TechCorp"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({...formData, country: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-primary dark:text-white"
                    placeholder="United States"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Country Flag (Emoji)</label>
                  <input
                    type="text"
                    value={formData.countryFlag}
                    onChange={(e) => setFormData({...formData, countryFlag: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-primary dark:text-white"
                    placeholder="🇺🇸"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border border-slate-200 dark:border-white/10 shrink-0 bg-slate-100 dark:bg-black/50">
                  <img src={formData.avatar} alt="Avatar preview" className="w-full h-full object-cover" />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader className="w-4 h-4 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Upload Photo (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading || isSubmitting}
                    className="block w-full text-sm text-slate-500 dark:text-gray-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary/10 file:text-primary
                      hover:file:bg-primary/20
                      disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Your Review *</label>
                  <span className={`text-xs ${wordCount > WORD_LIMIT ? 'text-red-500' : 'text-gray-400'}`}>
                    {wordCount} / {WORD_LIMIT} words
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={formData.quote}
                  onChange={(e) => {
                    const words = countWords(e.target.value);
                    if (words <= WORD_LIMIT + 10) { // allow a little buffer for typing before strictly cutting off, but won't submit
                      setFormData({...formData, quote: e.target.value});
                    }
                  }}
                  className={`w-full px-4 py-2 bg-slate-50 dark:bg-black/50 border ${wordCount > WORD_LIMIT ? 'border-red-500' : 'border-slate-200 dark:border-white/10'} rounded-lg focus:outline-none focus:border-primary dark:text-white resize-none`}
                  placeholder="Share your experience working with us..."
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || isUploading || wordCount > WORD_LIMIT || wordCount === 0}
                  className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-70"
                >
                  {isSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : 'Submit Review'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
