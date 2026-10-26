const mongoose = require('mongoose');

// Statuses every checklist step supports (Client Portal CRM §4)
const ITEM_STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Completed', 'Not Applicable'];

const itemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // stable id from the template, e.g. 'meta_pixel_capi'
    label: { type: String, required: true },
    // Launch-critical steps must be Completed (or Not Applicable, with a reason)
    // before the campaign can go live — unless an authorised exception is logged.
    launchCritical: { type: Boolean, default: true },
    // Steps that must carry evidence (a link or a note) before they can be Completed
    needsEvidence: { type: Boolean, default: false },
    status: { type: String, enum: ITEM_STATUSES, default: 'Not Started' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    dueDate: { type: Date },
    completedAt: { type: Date },
    remarks: { type: String, trim: true, maxlength: 1000 },
    evidenceLink: { type: String, trim: true, maxlength: 500 }, // document / approval / validation link
    blocker: { type: String, trim: true, maxlength: 500 },
    // What the CLIENT is allowed to see (everything else on a step is internal):
    // a step with a clientMessage shows as "Waiting on you"; the proof link is shown
    // only when shareProof is on (and the link is a plain https URL).
    shareProof: { type: Boolean, default: false },
    clientMessage: { type: String, trim: true, maxlength: 300 },
    naReason: { type: String, trim: true, maxlength: 500 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    updatedAt: { type: Date },
    // Last day an overdue/blocked alert was sent, so the daily job alerts once per day
    lastAlertedOn: { type: String },
  },
  { _id: false }
);

const onboardingChecklistSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, unique: true },
    items: { type: [itemSchema], default: [] },
    // The services / platforms the item list was built for (see services/onboarding.js)
    scope: {
      services: { type: [String], default: [] },
      platforms: { type: [String], default: [] },
    },
    goLive: {
      isLive: { type: Boolean, default: false },
      liveDate: { type: Date },
      liveBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      platformLinks: { type: [String], default: [] }, // platform / campaign links recorded at launch
      // Present when the campaign went live with launch-critical steps still open
      exception: {
        reason: { type: String, trim: true },
        authorisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        authorisedAt: { type: Date },
        waivedItems: { type: [String], default: [] },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OnboardingChecklist', onboardingChecklistSchema);
module.exports.ITEM_STATUSES = ITEM_STATUSES;
