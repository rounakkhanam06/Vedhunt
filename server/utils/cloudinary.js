const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const logger = require('./logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vedhunt-cms',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, webp, svg) are allowed'), false);
    }
  },
});

const deleteFromCloudinary = async (publicId, isRaw = false) => {
  try {
    const options = isRaw ? { resource_type: 'raw' } : {};
    const result = await cloudinary.uploader.destroy(publicId, options);
    logger.info(`Cloudinary delete: ${publicId} → ${result.result}`);
    return result;
  } catch (err) {
    logger.error('Cloudinary delete error:', err);
    throw err;
  }
};

const resumeStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'vedhunt-resumes',
    resource_type: 'raw',
  },
});

const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
    }
  },
});

module.exports = { cloudinary, upload, uploadResume, deleteFromCloudinary };
