import api from './api';

export const uploadService = {
  uploadImage: async (file) => {
    // 5MB limit check (matches backend cloudinary config)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size exceeds the maximum limit of 5MB.');
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': undefined,
        },
      });
      return response.data;
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        throw new Error(error.response.data.message === 'File too large' 
          ? 'File size exceeds the maximum limit of 5MB.' 
          : error.response.data.message);
      }
      throw new Error('Failed to upload image. Please try again.');
    }
  },

  deleteImage: async (publicId) => {
    const response = await api.delete(`/upload/${encodeURIComponent(publicId)}`);
    return response.data;
  }
};
