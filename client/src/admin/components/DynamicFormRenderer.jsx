import { useState, useEffect } from 'react';
import { uploadService } from '../../services/uploadService';
import { Loader2, Upload, Trash2 } from 'lucide-react';

const DynamicFormRenderer = ({ config, initialData = {}, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState(initialData);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (Object.keys(initialData).length > 0) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e, name) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await uploadService.uploadImage(file);
      // We assume config for image fields corresponds to `Url` and `PublicId` pair
      // Example: name="backgroundImageUrl" will also set "backgroundImagePublicId"
      const publicIdName = name.replace('Url', 'PublicId');
      
      setFormData(prev => ({ 
        ...prev, 
        [name]: res.url,
        [publicIdName]: res.publicId 
      }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error("Upload failed", error);
      toast.error(error.message || 'Image upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async (urlName, publicIdName) => {
    const publicId = formData[publicIdName];
    if (publicId) {
      try {
        await uploadService.deleteImage(publicId);
      } catch (err) {
        console.error("Delete from cloudinary failed", err);
      }
    }
    
    setFormData(prev => ({ 
      ...prev, 
      [urlName]: '',
      [publicIdName]: '' 
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {config.map((field) => {
        const value = formData[field.name] !== undefined ? formData[field.name] : '';

        return (
          <div key={field.name} className="flex flex-col space-y-1">
            {field.type !== 'boolean' && (
              <label className="text-sm font-medium text-gray-300">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
            )}

            {field.type === 'text' || field.type === 'url' ? (
              <input
                type={field.type}
                required={field.required}
                className="rounded-md border border-white/10 bg-[#1A1A1A] px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                value={value}
                onChange={(e) => handleChange(field.name, e.target.value)}
              />
            ) : field.type === 'textarea' ? (
              <textarea
                required={field.required}
                rows={4}
                className="rounded-md border border-white/10 bg-[#1A1A1A] px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-y overflow-x-hidden custom-scrollbar"
                value={value}
                onChange={(e) => handleChange(field.name, e.target.value)}
              />
            ) : field.type === 'boolean' ? (
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={value === true}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${value ? 'bg-orange-500' : 'bg-white/10'}`}
                  onClick={() => handleChange(field.name, !value)}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${value ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm font-medium text-gray-300">
                  {field.label} {value ? '(On)' : '(Off)'}
                </span>
              </div>
            ) : field.type === 'image' ? (
              <div className="mt-1">
                {value ? (
                  <div className="relative inline-block">
                    <img src={value} alt="Preview" className="h-40 rounded-md object-cover border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(field.name, field.name.replace('Url', 'PublicId'))}
                      className="absolute -right-2 -top-2 rounded-full bg-red-100 p-1 text-red-600 hover:bg-red-200"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex w-full items-center justify-center">
                    <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center pb-6 pt-5">
                        {isUploading ? <Loader2 className="mb-2 h-8 w-8 animate-spin text-gray-500" /> : <Upload className="mb-2 h-8 w-8 text-gray-500" />}
                        <p className="text-sm text-gray-500">
                          {isUploading ? 'Uploading...' : 'Click to upload image'}
                        </p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, field.name)} disabled={isUploading} />
                    </label>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="pt-4">
        <button
          type="submit"
          disabled={isLoading || isUploading}
          className="flex justify-center rounded-md border border-transparent bg-[#FF6B00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66000] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

export default DynamicFormRenderer;
