const mongoose = require('mongoose');
const { findLeadRaw } = require('../utils/leadLookup');
const { deleteFromCloudinary } = require('../utils/cloudinary');

/**
 * Shared by both the admin (leadController) and Employee Portal
 * (employeePortalRoutes) document endpoints, same split as
 * services/leadLifecycle.js — one place enforces ownership scoping via
 * extraFilter and writes through the raw driver, consistent with every
 * other lead mutation.
 */
async function addLeadDocument(leadId, file, docType, actorId, extraFilter = {}) {
  const existingLead = await findLeadRaw(leadId, extraFilter);
  if (!existingLead) return { ok: false, status: 404, message: 'Lead not found' };

  const doc = {
    _id: new mongoose.Types.ObjectId(),
    name: file.originalname,
    url: file.path,
    publicId: file.filename,
    docType: docType || 'Attachment',
    uploadedBy: actorId,
    uploadedAt: new Date(),
    isImage: file.mimetype.startsWith('image/')
  };

  const db = mongoose.connection.db;
  const result = await db.collection('leads').findOneAndUpdate(
    { _id: existingLead._id },
    { $push: { documents: doc } },
    { returnDocument: 'after' }
  );
  return { ok: true, lead: result?.value || result, document: doc };
}

async function removeLeadDocument(leadId, docId, extraFilter = {}) {
  const existingLead = await findLeadRaw(leadId, extraFilter);
  if (!existingLead) return { ok: false, status: 404, message: 'Lead not found' };

  const target = (existingLead.documents || []).find((d) => String(d._id) === String(docId));
  if (!target) return { ok: false, status: 404, message: 'Document not found' };

  const db = mongoose.connection.db;
  const result = await db.collection('leads').findOneAndUpdate(
    { _id: existingLead._id },
    { $pull: { documents: { _id: new mongoose.Types.ObjectId(docId) } } },
    { returnDocument: 'after' }
  );

  try {
    await deleteFromCloudinary(target.publicId, !target.isImage);
  } catch {
    // The DB reference is already gone — an orphaned Cloudinary file isn't
    // worth failing the request over.
  }

  return { ok: true, lead: result?.value || result };
}

module.exports = { addLeadDocument, removeLeadDocument };
