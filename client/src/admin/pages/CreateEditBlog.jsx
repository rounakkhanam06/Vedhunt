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

  useEffect(() => {
    if (isEdit) {
      fetchBlog();
    }
  }, [slug]);

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
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8 pb-32">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to="/admin/blogs" className="p-2 bg-surface-variant rounded-full text-on-surface-variant hover:text-on-surface">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-heading font-bold text-on-surface">
            {isEdit ? 'Edit Blog' : 'Create Blog'}
          </h1>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-primary text-black font-bold px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover transition-colors disabled:opacity-50"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Blog'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-on-surface-variant">Title</label>
              <input 
                type="text" 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary"
                required
              />
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-on-surface-variant">Excerpt</label>
              <p className="text-xs text-on-surface-variant/70 mb-2">A short summary of the blog that appears on the blog listing cards.</p>
              <textarea 
                value={formData.excerpt} 
                onChange={e => setFormData({...formData, excerpt: e.target.value})}
                className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary min-h-[100px]"
              />
            </div>
          </div>

          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
                  Content Blocks (Article Body)
                </h2>
                <p className="text-xs text-on-surface-variant/70 mt-1">
                  Build the main body of your blog post here by adding and arranging different types of content blocks.
                </p>
              </div>
              <span className="text-sm font-normal text-on-surface-variant bg-surface-variant px-3 py-1 rounded-full whitespace-nowrap">
                {formData.contentBlocks.length} Blocks
              </span>
            </div>
            
            <div className="space-y-6">
              {formData.contentBlocks.map((block, index) => (
                <div key={block.id || index} className="border border-outline-variant rounded-lg p-4 bg-surface relative group">
                  <div className="flex justify-between items-center mb-4 border-b border-outline-variant pb-2">
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className="text-on-surface-variant cursor-grab active:cursor-grabbing" />
                      <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded">
                        {block.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => moveBlock(index, -1)} disabled={index === 0} className="p-1 text-on-surface-variant hover:text-on-surface disabled:opacity-30">
                        <ArrowUp size={16} />
                      </button>
                      <button onClick={() => moveBlock(index, 1)} disabled={index === formData.contentBlocks.length - 1} className="p-1 text-on-surface-variant hover:text-on-surface disabled:opacity-30">
                        <ArrowDown size={16} />
                      </button>
                      <button onClick={() => removeBlock(index)} className="p-1 text-on-surface-variant hover:text-error ml-2">
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
                      className="w-full bg-surface-variant/30 border border-outline-variant rounded px-4 py-2 text-on-surface focus:outline-none focus:border-primary min-h-[120px]"
                    />
                  )}

                  {block.type === 'heading' && (
                    <div className="space-y-3">
                      <input 
                        type="text" 
                        value={block.data.text} 
                        onChange={e => updateBlock(index, 'text', e.target.value)}
                        placeholder="Heading text..."
                        className="w-full bg-surface-variant/30 border border-outline-variant rounded px-4 py-2 text-on-surface focus:outline-none focus:border-primary text-xl font-bold"
                      />
                      <select 
                        value={block.data.level} 
                        onChange={e => updateBlock(index, 'level', parseInt(e.target.value))}
                        className="w-32 bg-surface-variant/30 border border-outline-variant rounded px-4 py-2 text-on-surface focus:outline-none focus:border-primary"
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
                        className="w-full bg-surface-variant/30 border border-outline-variant rounded px-4 py-2 text-on-surface focus:outline-none focus:border-primary"
                      />
                      <input 
                        type="text" 
                        value={block.data.caption} 
                        onChange={e => updateBlock(index, 'caption', e.target.value)}
                        placeholder="Optional image caption..."
                        className="w-full bg-surface-variant/30 border border-outline-variant rounded px-4 py-2 text-on-surface text-sm focus:outline-none focus:border-primary"
                      />
                      {block.data.url && (
                        <img src={block.data.url} alt="Preview" className="w-full h-40 object-cover rounded mt-2 opacity-80" />
                      )}
                    </div>
                  )}

                  {block.type === 'quote' && (
                    <div className="space-y-3">
                      <textarea 
                        value={block.data.text} 
                        onChange={e => updateBlock(index, 'text', e.target.value)}
                        placeholder="Quote text..."
                        className="w-full bg-surface-variant/30 border border-outline-variant rounded px-4 py-2 text-on-surface focus:outline-none focus:border-primary font-serif italic"
                      />
                      <input 
                        type="text" 
                        value={block.data.author} 
                        onChange={e => updateBlock(index, 'author', e.target.value)}
                        placeholder="Quote author (optional)..."
                        className="w-full bg-surface-variant/30 border border-outline-variant rounded px-4 py-2 text-on-surface text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap gap-3 pt-4 border-t border-outline-variant">
                <span className="w-full text-sm font-medium text-on-surface-variant mb-1">Add New Content Block:</span>
                <button onClick={() => addBlock('paragraph')} className="px-4 py-2 bg-surface-variant text-on-surface rounded hover:bg-primary/20 hover:text-primary text-sm font-medium transition-colors">+ Add Text Paragraph</button>
                <button onClick={() => addBlock('heading')} className="px-4 py-2 bg-surface-variant text-on-surface rounded hover:bg-primary/20 hover:text-primary text-sm font-medium transition-colors">+ Add Heading</button>
                <button onClick={() => addBlock('image')} className="px-4 py-2 bg-surface-variant text-on-surface rounded hover:bg-primary/20 hover:text-primary text-sm font-medium transition-colors" title="Add an image inside the article body">+ Add Inline Image</button>
                <button onClick={() => addBlock('quote')} className="px-4 py-2 bg-surface-variant text-on-surface rounded hover:bg-primary/20 hover:text-primary text-sm font-medium transition-colors">+ Add Quote</button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar settings */}
        <div className="space-y-6">
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 space-y-4">
            <h3 className="font-bold text-on-surface text-lg border-b border-outline-variant pb-2">Publish Settings</h3>
            
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="isPublished"
                checked={formData.isPublished}
                onChange={e => setFormData({...formData, isPublished: e.target.checked})}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
              <label htmlFor="isPublished" className="text-on-surface cursor-pointer font-medium">Publish Blog</label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-on-surface-variant">Slug</label>
              <input 
                type="text" 
                value={formData.slug} 
                onChange={e => setFormData({...formData, slug: e.target.value})}
                placeholder="auto-generated-if-empty"
                className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-on-surface-variant">Category</label>
              <input 
                type="text" 
                value={formData.category} 
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-on-surface-variant">Author</label>
              <input 
                type="text" 
                value={formData.author} 
                onChange={e => setFormData({...formData, author: e.target.value})}
                className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary"
              />
            </div>
            
            <div className="mb-2">
              <label className="block text-sm font-medium text-on-surface-variant">Thumbnail (Cover Image)</label>
              <p className="text-xs text-on-surface-variant/70 mb-2">This is the main cover image. It appears on the blog cards and at the very top of the article.</p>
              <div className="flex gap-2 mb-2">
                <input 
                  type="text" 
                  value={formData.thumbnail} 
                  onChange={e => setFormData({...formData, thumbnail: e.target.value})}
                  placeholder="Image URL"
                  className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-outline-variant border-dashed rounded-lg cursor-pointer bg-surface hover:bg-surface-variant transition-colors relative overflow-hidden">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {uploadingThumbnail ? (
                      <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                    ) : (
                      <Upload className="w-8 h-8 text-on-surface-variant mb-2" />
                    )}
                    <p className="text-sm text-on-surface-variant">
                      <span className="font-semibold">Click to upload</span> Cloudinary
                    </p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleThumbnailUpload} disabled={uploadingThumbnail} />
                </label>
              </div>
              {formData.thumbnail && (
                <img src={formData.thumbnail} alt="Thumbnail Preview" className="w-full h-32 object-cover rounded mt-3 border border-outline-variant" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEditBlog;
