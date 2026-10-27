const mongoose = require('mongoose');

// Notes on a lead, kept out of the Lead document so no lead response can leak
// a private note. Only a super admin may edit or delete one: an edit keeps the
// previous text in the audit log, and a delete only hides the note (deletedAt),
// so every note stays its own record (author + createdAt).
//   shared  → everyone who can see the lead
//   private → the author and admins with all-leads access only
const leadNoteSchema = new mongoose.Schema({
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  visibility: {
    type: String,
    enum: ['shared', 'private'],
    default: 'shared'
  },
  editedAt: Date,
  editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

leadNoteSchema.index({ lead: 1, createdAt: -1 });

module.exports = mongoose.model('LeadNote', leadNoteSchema);
