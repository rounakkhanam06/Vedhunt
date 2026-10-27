const mongoose = require('mongoose');

// Work outside the signed scope (Client Journey SOP §10, §15): assess it, quote it, get the client's
// written approval, and only then start — and bill it separately. The approval is a normal client
// approval (models/Approval.js, kind "Change request"), so the client answers in the same place and
// the answer is never copied here: this document reads its approval to know where it stands.
const WORK_STATUSES = ['Not started', 'In progress', 'Done'];

const changeRequestSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true }, // CR-<number>
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    approval_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Approval', required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 3000 }, // what is being asked for
    quoteAmount: { type: Number, required: true, min: 0 }, // fee, excl. GST
    estimatedDays: { type: Number, min: 0 }, // working days, for the timeline
    // The effort / impact assessment (internal)
    assessment: { type: String, trim: true, maxlength: 1500 },
    workStatus: { type: String, enum: WORK_STATUSES, default: 'Not started' },
    startedAt: { type: Date },
    doneAt: { type: Date },
    invoice_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }, // set once: one invoice per change request
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);
module.exports.WORK_STATUSES = WORK_STATUSES;
