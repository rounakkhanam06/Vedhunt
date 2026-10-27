const mongoose = require('mongoose');

// What has to be true before a client is marked Offboarded (Client Journey SOP §14). Two steps are
// worked out live from the records (final invoice settled, platform access revoked) and are never
// stored; the rest are confirmed here by staff, each with a note and who/when.
const confirmSchema = new mongoose.Schema(
  {
    done: { type: Boolean, default: false },
    note: { type: String, trim: true, maxlength: 500 },
    doneAt: { type: Date },
    doneByName: { type: String, trim: true },
  },
  { _id: false }
);

const offboardingChecklistSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, unique: true },
    noticeDate: { type: Date }, // when the client gave notice / the decision was made
    effectiveDate: { type: Date }, // the last day of service
    handover: { type: confirmSchema, default: () => ({}) }, // final report, files and learnings handed over
    retention: { type: confirmSchema, default: () => ({}) }, // what happens to the client's documents and personal data
    closure: { type: confirmSchema, default: () => ({}) }, // Super Admin approval to close the account
    startedByName: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OffboardingChecklist', offboardingChecklistSchema);
