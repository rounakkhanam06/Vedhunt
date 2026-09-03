const path = require('path');
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

/** Uploads an in-memory buffer (e.g. a generated PDF) without going through multer/disk. */
const uploadBuffer = (buffer, { folder, public_id, resource_type = 'raw' }) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, public_id, resource_type }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedMime = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.doc', '.docx'];

    if (allowedMime.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'), false);
    }
  },
});

// Lead documents (proposals, quotations, scope docs, general attachments) —
// PDFs/Office docs go up as raw resources same as resumes; images stay
// browser-viewable via the default 'image' resource type.
const leadDocumentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => ({
    folder: 'vedhunt-lead-documents',
    resource_type: file.mimetype.startsWith('image/') ? 'image' : 'raw',
  }),
});

const uploadLeadDocument = multer({
  storage: leadDocumentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedMime = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    const allowedExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMime.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC/DOCX, XLS/XLSX, and image files are allowed'), false);
    }
  },
});

module.exports = { cloudinary, upload, uploadResume, uploadLeadDocument, uploadBuffer, deleteFromCloudinary };
