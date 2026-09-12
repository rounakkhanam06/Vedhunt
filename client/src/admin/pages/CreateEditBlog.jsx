import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Plus, Trash2, GripVertical, ArrowUp, ArrowDown, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import { uploadService } from '../../services/uploadService';
import api from '../../services/api';
import toast from 'react-hot-toast';

const blockTemplates = {
  paragraph: { type: 'paragraph', data: { text: '' } },
  heading: { type: 'heading', data: { text: '', level: 2 } },
  image: { type: 'image', data: { url: '', caption: '' } },
  quote: { type: 'quote', data: { text: '', author: '' } }
};

const CreateEditBlog = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isEdit = !!slug;

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    category: '',
    author: 'Vedhunt Team',
    thumbnail: '',
    isPublished: false,
    contentBlocks: []
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchCategories();
    if (isEdit) {
      fetchBlog();
    }
  }, [slug]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/blog-categories?activeOnly=true');
      if (res.data?.success) {
        setCategories(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchBlog = async () => {
    try {
      const res = await api.get(`/blogs/admin/slug/${slug}`);
      const data = res.data;
      if (data.success) {
        setFormData(data.data);
      } else {
        alert('Blog not found');
        navigate('/admin/blogs');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleThumbnailUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploadingThumbnail(true);
      const response = await uploadService.uploadImage(file);
      setFormData(prev => ({ ...prev, thumbnail: response.url }));
    } catch (error) {
      if (error.message) {
        toast.error(error.message);
      } else {
        toast.error('Failed to upload thumbnail');
      }
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const url = isEdit ? `/blogs/${slug}` : '/blogs';
      
      const res = isEdit ? await api.put(url, formData) : await api.post(url, formData);
      
      const data = res.data;
      if (data.success) {
        alert('Blog saved successfully!');
        navigate('/admin/blogs');
      } else {
        alert('Failed to save blog: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error saving blog');
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type) => {
    const newBlock = { ...blockTemplates[type], id: Date.now().toString() };
    setFormData(prev => ({
      ...prev,
      contentBlocks: [...prev.contentBlocks, newBlock]
    }));
  };

  const updateBlock = (index, field, value) => {
    const newBlocks = [...formData.contentBlocks];
    newBlocks[index].data[field] = value;
    setFormData({ ...formData, contentBlocks: newBlocks });
  };

  const removeBlock = (index) => {
    const newBlocks = [...formData.contentBlocks];
    newBlocks.splice(index, 1);
    setFormData({ ...formData, contentBlocks: newBlocks });
  };

  const moveBlock = (index, direction) => {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === formData.contentBlocks.length - 1) return;
    
    const newBlocks = [...formData.contentBlocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[index + direction];
    newBlocks[index + direction] = temp;
    setFormData({ ...formData, contentBlocks: newBlocks });
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top action bar */}
      <div className="flex justify-between items-center pb-4 border-b border-app-border">
        <div className="flex items-center gap-4">
          <Link to="/admin/blogs" className="p-2 bg-surface-variant rounded-full text-app-text-muted hover:text-app-text transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-app-text">
            {isEdit ? 'Edit Blog' : 'Create Blog'}
          </h1>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-[#FF6B00] text-white font-semibold px-6 py-2.5 rounded-lg flex items-center gap-2 hover:bg-[#e66000] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Blog'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-app-card border border-app-border rounded-xl p-6 space-y-4 shadow-sm">
            <div>
              <label className="block text-sm font-medium mb-1 text-app-text">Title</label>
              <input 
                type="text" 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] transition-colors"
                required
              />
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-app-text">Excerpt</label>
              <p className="text-xs text-app-text-muted mb-2">A short summary of the blog that appears on the blog listing cards.</p>
              <textarea 
                value={formData.excerpt} 
                onChange={e => setFormData({...formData, excerpt: e.target.value})}
                className="w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] min-h-[100px] transition-colors"
              />
            </div>
          </div>

          <div className="bg-app-card border border-app-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-bold text-app-text flex items-center gap-2">
                  Content Blocks (Article Body)
                </h2>
                <p className="text-xs text-app-text-muted mt-1">
                  Build the main body of your blog post here by adding and arranging different types of content blocks.
                </p>
              </div>
              <span className="text-sm font-normal text-app-text-muted bg-surface-variant px-3 py-1 rounded-full whitespace-nowrap">
                {formData.contentBlocks.length} Blocks
              </span>
            </div>
            
            <div className="space-y-6">
              {formData.contentBlocks.map((block, index) => (
                <div key={block.id || index} className="border border-app-border rounded-lg p-4 bg-app-card relative group">
                  <div className="flex justify-between items-center mb-4 border-b border-app-border pb-2">
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className="text-app-text-muted cursor-grab active:cursor-grabbing" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B00] bg-[#FF6B00]/10 px-2 py-1 rounded">
                        {block.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => moveBlock(index, -1)} disabled={index === 0} className="p-1 text-app-text-muted hover:text-app-text cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                        <ArrowUp size={16} />
                      </button>
                      <button onClick={() => moveBlock(index, 1)} disabled={index === formData.contentBlocks.length - 1} className="p-1 text-app-text-muted hover:text-app-text cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                        <ArrowDown size={16} />
                      </button>
                      <button onClick={() => removeBlock(index)} className="p-1 text-app-text-muted hover:text-red-500 cursor-pointer ml-2">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Block Editor UI */}
                  {block.type === 'paragraph' && (
                    <textarea 
                      value={block.data.text} 
                      onChange={e => updateBlock(index, 'text', e.target.value)}
                      placeholder="Enter paragraph text..."
                      className="w-full bg-form-input-bg border border-app-border rounded px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] min-h-[120px] transition-colors"
                    />
                  )}

                  {block.type === 'heading' && (
                    <div className="space-y-3">
                      <input 
                        type="text" 
                        value={block.data.text} 
                        onChange={e => updateBlock(index, 'text', e.target.value)}
                        placeholder="Heading text..."
                        className="w-full bg-form-input-bg border border-app-border rounded px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] text-xl font-bold transition-colors"
                      />
                      <select 
                        value={block.data.level} 
                        onChange={e => updateBlock(index, 'level', parseInt(e.target.value))}
                        className="w-32 bg-form-input-bg border border-app-border rounded px-4 py-2 text-app-text cursor-pointer focus:outline-none focus:border-[#FF6B00]"
                      >
                        <option value={2}>H2</option>
                        <option value={3}>H3</option>
                        <option value={4}>H4</option>
                      </select>
                    </div>
                  )}

                  {block.type === 'image' && (
                    <div className="space-y-3">
                      <input 
                        type="text" 
                        value={block.data.url} 
                        onChange={e => updateBlock(index, 'url', e.target.value)}
                        placeholder="Image URL..."
                        className="w-full bg-form-input-bg border border-app-border rounded px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] transition-colors"
                      />
                      <input 
                        type="text" 
                        value={block.data.caption} 
                        onChange={e => updateBlock(index, 'caption', e.target.value)}
                        placeholder="Optional image caption..."
                        className="w-full bg-form-input-bg border border-app-border rounded px-4 py-2 text-app-text placeholder-app-text-muted text-sm focus:outline-none focus:border-[#FF6B00] transition-colors"
                      />
                      {block.data.url && (
                        <img src={block.data.url} alt="Preview" className="w-full h-40 object-cover rounded mt-2 border border-app-border" />
                      )}
                    </div>
                  )}

                  {block.type === 'quote' && (
                    <div className="space-y-3">
                      <textarea 
                        value={block.data.text} 
                        onChange={e => updateBlock(index, 'text', e.target.value)}
                        placeholder="Quote text..."
                        className="w-full bg-form-input-bg border border-app-border rounded px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] font-serif italic transition-colors"
                      />
                      <input 
                        type="text" 
                        value={block.data.author} 
                        onChange={e => updateBlock(index, 'author', e.target.value)}
                        placeholder="Quote author (optional)..."
                        className="w-full bg-form-input-bg border border-app-border rounded px-4 py-2 text-app-text placeholder-app-text-muted text-sm focus:outline-none focus:border-[#FF6B00] transition-colors"
                      />
                    </div>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap gap-3 pt-4 border-t border-app-border">
                <span className="w-full text-sm font-medium text-app-text-muted mb-1">Add New Content Block:</span>
                <button onClick={() => addBlock('paragraph')} className="px-4 py-2 bg-surface-variant text-app-text rounded-lg hover:bg-[#FF6B00]/10 hover:text-[#FF6B00] cursor-pointer text-sm font-medium transition-colors border border-app-border">+ Add Text Paragraph</button>
                <button onClick={() => addBlock('heading')} className="px-4 py-2 bg-surface-variant text-app-text rounded-lg hover:bg-[#FF6B00]/10 hover:text-[#FF6B00] cursor-pointer text-sm font-medium transition-colors border border-app-border">+ Add Heading</button>
                <button onClick={() => addBlock('image')} className="px-4 py-2 bg-surface-variant text-app-text rounded-lg hover:bg-[#FF6B00]/10 hover:text-[#FF6B00] cursor-pointer text-sm font-medium transition-colors border border-app-border" title="Add an image inside the article body">+ Add Inline Image</button>
                <button onClick={() => addBlock('quote')} className="px-4 py-2 bg-surface-variant text-app-text rounded-lg hover:bg-[#FF6B00]/10 hover:text-[#FF6B00] cursor-pointer text-sm font-medium transition-colors border border-app-border">+ Add Quote</button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar settings */}
        <div className="space-y-6">
          <div className="bg-app-card border border-app-border rounded-xl p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-app-text text-lg border-b border-app-border pb-2">Publish Settings</h3>
            
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="isPublished"
                checked={formData.isPublished}
                onChange={e => setFormData({...formData, isPublished: e.target.checked})}
                className="w-5 h-5 accent-[#FF6B00] cursor-pointer"
              />
              <label htmlFor="isPublished" className="text-app-text cursor-pointer font-medium">Publish Blog</label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-app-text">Slug</label>
              <input 
                type="text" 
                value={formData.slug} 
                onChange={e => setFormData({...formData, slug: e.target.value})}
                placeholder="auto-generated-if-empty"
                className="w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] text-sm transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-app-text">Category</label>
              <select 
                value={formData.category} 
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2.5 text-app-text cursor-pointer focus:outline-none focus:border-[#FF6B00] uppercase transition-colors"
                required
              >
                <option value="" disabled>Select a category</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-app-text">Author</label>
              <input 
                type="text" 
                value={formData.author} 
                onChange={e => setFormData({...formData, author: e.target.value})}
                className="w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] transition-colors"
              />
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-app-text">Thumbnail (Cover Image)</label>
              <p className="text-xs text-app-text-muted mb-2">This is the main cover image. It appears on the blog cards and at the very top of the article.</p>
              <div className="flex gap-2 mb-2">
                <input 
                  type="text" 
                  value={formData.thumbnail} 
                  onChange={e => setFormData({...formData, thumbnail: e.target.value})}
                  placeholder="Image URL"
                  className="w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] transition-colors"
                />
              </div>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-app-border border-dashed rounded-lg cursor-pointer bg-form-input-bg hover:bg-surface-variant transition-colors relative overflow-hidden">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {uploadingThumbnail ? (
                      <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin mb-2" />
                    ) : (
                      <Upload className="w-8 h-8 text-app-text-muted mb-2" />
                    )}
                    <p className="text-sm text-app-text-muted">
                      <span className="font-semibold text-app-text">Click to upload</span> to Cloudinary
                    </p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleThumbnailUpload} disabled={uploadingThumbnail} />
                </label>
              </div>
              {formData.thumbnail && (
                <img src={formData.thumbnail} alt="Thumbnail Preview" className="w-full h-32 object-cover rounded-lg mt-3 border border-app-border" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEditBlog;
