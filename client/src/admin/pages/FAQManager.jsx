import { useState, useEffect } from 'react';
import { faqService } from '../../services/faqService';
import { Pencil, Trash2, Loader2, Plus, Save, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const FAQManager = () => {
  const [faqs, setFaqs] = useState([]);
  const [content, setContent] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Modals / forms
  const [isContentOpen, setIsContentOpen] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [isSavingFaq, setIsSavingFaq] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const [faqFormData, setFaqFormData] = useState({
    question: '',
    answer: '',
    category: 'frequent',
    order: 0
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const contentRes = await faqService.getFaqContent();
      setContent(contentRes.data || {});

      const faqsRes = await faqService.getFaqs();
      setFaqs(faqsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch FAQ data:', error);
      toast.error('Failed to fetch FAQ data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleContentSubmit = async (e) => {
    e.preventDefault();
    setIsSavingContent(true);
    try {
      await faqService.updateFaqContent(content);
      toast.success('FAQ Content updated successfully!');
      setIsContentOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update content');
      console.error(error);
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleOpenFaqForm = (faq = null) => {
    if (faq) {
      setEditingFaq(faq);
      setFaqFormData({
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        order: faq.order || 0
      });
    } else {
      setEditingFaq(null);
      setFaqFormData({
        question: '',
        answer: '',
        category: 'frequent',
        order: 0
      });
    }
    setIsFaqModalOpen(true);
  };

  const handleCloseFaqForm = () => {
    setIsFaqModalOpen(false);
    setEditingFaq(null);
  };

  const handleFaqSubmit = async (e) => {
    e.preventDefault();
    setIsSavingFaq(true);
    try {
      if (editingFaq) {
        await faqService.updateFaq(editingFaq._id, faqFormData);
        toast.success('FAQ updated successfully!');
      } else {
        await faqService.createFaq(faqFormData);
        toast.success('FAQ created successfully!');
      }
      handleCloseFaqForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save FAQ');
      console.error(error);
    } finally {
      setIsSavingFaq(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await faqService.deleteFaq(deleteTargetId);
      toast.success('FAQ deleted successfully');
      setDeleteTargetId(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete FAQ');
      console.error(error);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white">Manage FAQs</h1>
          <p className="mt-1 text-sm text-gray-400">Update FAQ page headers, contact info, and question lists.</p>
        </div>
      </div>

      {/* Content Manager */}
      <div className="bg-[#222222] border border-white/10 rounded-xl overflow-hidden mb-6">
        <button
          onClick={() => setIsContentOpen(!isContentOpen)}
          className="w-full flex items-center justify-between p-4 bg-[#1A1A1A] hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div>
            <h3 className="text-lg font-bold text-white text-left">Manage Page Headers & Contact Info</h3>
            <p className="text-sm text-gray-400 text-left">Update the headings and contact details across the FAQ page.</p>
          </div>
          {isContentOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        
        {isContentOpen && (
          <div className="p-6 border-t border-white/10">
            <form onSubmit={handleContentSubmit} className="space-y-6">
              
              {/* Hero Section */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-[#FF6B00]">Hero Section</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Hero Title</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.heroTitle || ''}
                      onChange={(e) => setContent({ ...content, heroTitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Hero Subtitle</label>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.heroSubtitle || ''}
                      onChange={(e) => setContent({ ...content, heroSubtitle: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Sections Headers */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-[#FF6B00]">Sections Headers</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Section 1 Title (Frequent FAQs)</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.section1Title || ''}
                      onChange={(e) => setContent({ ...content, section1Title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Section 1 Subtitle</label>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.section1Subtitle || ''}
                      onChange={(e) => setContent({ ...content, section1Subtitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Section 2 Title (Regular FAQs)</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.section2Title || ''}
                      onChange={(e) => setContent({ ...content, section2Title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Contact Section Title</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.contactTitle || ''}
                      onChange={(e) => setContent({ ...content, contactTitle: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Contact Info Details */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-[#FF6B00]">Contact Info Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Contact Subtitle</label>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.contactSubtitle || ''}
                      onChange={(e) => setContent({ ...content, contactSubtitle: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Address Main</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.contactAddress || ''}
                      onChange={(e) => setContent({ ...content, contactAddress: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Address Sub</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.contactAddressSub || ''}
                      onChange={(e) => setContent({ ...content, contactAddressSub: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email Main</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.contactEmail || ''}
                      onChange={(e) => setContent({ ...content, contactEmail: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email Sub</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.contactEmailSub || ''}
                      onChange={(e) => setContent({ ...content, contactEmailSub: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Phone Main</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.contactPhone || ''}
                      onChange={(e) => setContent({ ...content, contactPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Phone Sub (Working Hours)</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                      value={content.contactPhoneSub || ''}
                      onChange={(e) => setContent({ ...content, contactPhoneSub: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSavingContent}
                  className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSavingContent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Content
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* FAQ Items Section */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">FAQ Items</h2>
        <button
          onClick={() => handleOpenFaqForm()}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add FAQ
        </button>
      </div>

      <div className="bg-[#222222] shadow-xl border border-white/10 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#FF6B00]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-[#1A1A1A]">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Question</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Order</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-[#222222] divide-y divide-white/10">
                {faqs.length > 0 ? faqs.map((faq) => (
                  <tr key={faq._id} className="hover:bg-white/5">
                    <td className="px-6 py-4 text-sm font-medium text-gray-200">
                      <div className="line-clamp-2 max-w-lg">{faq.question}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${faq.category === 'frequent' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {faq.category === 'frequent' ? 'Frequent' : 'Regular'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {faq.order}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <button onClick={() => handleOpenFaqForm(faq)} className="text-[#FF6B00] hover:text-[#e66000]" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTargetId(faq._id)} className="text-red-500 hover:text-red-400" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                      No FAQs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FAQ Form Modal */}
      {isFaqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#222222] border border-white/10 rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-white">
              {editingFaq ? 'Edit FAQ' : 'Add FAQ'}
            </h3>
            
            <form onSubmit={handleFaqSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Question *</label>
                <input
                  type="text"
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                  value={faqFormData.question}
                  onChange={(e) => setFaqFormData({ ...faqFormData, question: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Answer *</label>
                <textarea
                  rows={4}
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                  value={faqFormData.answer}
                  onChange={(e) => setFaqFormData({ ...faqFormData, answer: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                    value={faqFormData.category}
                    onChange={(e) => setFaqFormData({ ...faqFormData, category: e.target.value })}
                  >
                    <option value="frequent">Frequent</option>
                    <option value="regular">Regular</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Order</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-3.5 py-2 text-sm text-gray-100 focus:border-[#FF6B00] focus:outline-none focus:ring-1 focus:ring-[#FF6B00]"
                    value={faqFormData.order}
                    onChange={(e) => setFaqFormData({ ...faqFormData, order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseFaqForm}
                  className="px-4 py-2 bg-[#1A1A1A] hover:bg-white/5 border border-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingFaq}
                  className="px-4 py-2 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-lg text-sm font-medium shadow-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingFaq ? 'Saving...' : 'Save FAQ'}
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
                <h3 className="text-lg font-bold text-white">Delete FAQ</h3>
                <p className="text-xs text-gray-400 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-300">
              Are you sure you want to delete this FAQ? It will be removed immediately.
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
                Delete FAQ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FAQManager;
