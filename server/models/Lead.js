const mongoose = require('mongoose');
const { normalizePhone, normalizeEmail } = require('../utils/normalize');
const { NOT_CONNECTED_REASONS, INTEREST_LEVELS, LOST_DROPPED_REASONS } = require('../utils/leadStateMachine');

const leadSchema = new mongoose.Schema({
  // Full original submission payload, captured once at ingestion (before
  // dedup/assignment run) so the raw request is always recoverable for audit,
  // regardless of what normalization or field-mapping happens afterward.
  rawPayload: {
    type: mongoose.Schema.Types.Mixed
  },
  fullName: {
    type: String,
    required: [true, 'Please provide full name'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Please provide phone number'],
    trim: true
  },
  altPhone: {
    type: String,
    trim: true
  },
  // Digits-only, country-code-stripped copies of phone/altPhone/email, kept in
  // sync by the pre-save hook below. Duplicate-lead lookups match against
  // these instead of the raw fields so "+91 98765 43210" and "9876543210"
  // are recognized as the same person.
  phoneNormalized: {
    type: String,
    trim: true
  },
  altPhoneNormalized: {
    type: String,
    trim: true
  },
  emailNormalized: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide email address'],
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please provide a valid email'
    ]
  },
  service: {
    type: String,
    required: [true, 'Please provide service needed']
  },
  businessName: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    required: [true, 'Please provide lead source'],
    trim: true
  },
  consent: {
    type: Boolean,
    required: [true, 'Consent is required']
  },
  city: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  platform: {
    type: String,
    enum: ['Website', 'Facebook', 'Instagram', 'Google Ads', 'Manual'],
    default: 'Website'
  },
  fbLeadId: {
    type: String,
    unique: true,
    sparse: true
  },
  // Which Instant Form produced this lead. One page runs many forms at once,
  // so this is what separates a BD hiring lead from a service enquiry.
  fbFormId: {
    type: String,
    trim: true
  },
  fbFormName: {
    type: String,
    trim: true
  },
  // Sales leads run the revenue pipeline; hiring leads are job applicants and
  // must stay out of sales counts and deal reporting.
  leadType: {
    type: String,
    enum: ['Sales', 'Hiring'],
    default: 'Sales'
  },
  adCampaignId: {
    type: String,
    trim: true
  },
  userSource: {
    type: String,
    trim: true,
    default: 'Direct'
  },
  utmSource: {
    type: String,
    trim: true
  },
  utmMedium: {
    type: String,
    trim: true
  },
  utmCampaign: {
    type: String,
    trim: true
  },
  utmContent: {
    type: String,
    trim: true
  },
  utmTerm: {
    type: String,
    trim: true
  },
  leadId: {
    type: String,
    unique: true,
    sparse: true
  },
  // Free-text display copy of the assigned BD's name, kept in sync by
  // server/services/leadAssignment.js. Not directly editable — ownership
  // changes must go through POST /leads/:id/assign so every change is
  // logged. Kept only so existing consumers (CSV export, Kanban card) that
  // read this plain string keep working.
  bd: {
    type: String,
    trim: true
  },
  // Source of truth for ownership, visibility scoping, and round-robin.
  // null = Unassigned.
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null,
    index: true
  },
  assignedAt: {
    type: Date,
    default: null
  },
  unassignedSlaDeadline: {
    type: Date,
    default: null
  },
  unassignedSlaAlerted: {
    type: Boolean,
    default: false
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  lockedAt: {
    type: Date,
    default: null
  },
  callStartTime: {
    type: Date
  },
  callEndTime: {
    type: Date
  },
  callDuration: {
    type: Number
  },
  callDate: {
    type: Date
  },
  connected: {
    type: String,
    enum: ['Yes', 'No', '', null]
  },
  // Real enforcement lives in server/utils/leadStateMachine.js — both update
  // paths write through the raw driver and bypass this schema validation.
  notConnectedReason: {
    type: String,
    enum: [...NOT_CONNECTED_REASONS, '', null],
    trim: true
  },
  interestLevel: {
    type: String,
    enum: [...INTEREST_LEVELS, '', null],
    trim: true
  },
  notConvertedReason: {
    type: String,
    enum: [...LOST_DROPPED_REASONS, '', null],
    trim: true
  },
  remark: {
    type: String,
    trim: true
  },
  nextFollowUpDate: {
    type: Date
  },
  leadAgeAtCall: {
    type: Number
  },
  touchNumber: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Dropped', 'Hold'],
    default: 'New'
  },

  pipelineHistory: [{
    status: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    note: {
      type: String,
      trim: true
    }
  }],

  // Append-only log of every call attempt — never overwritten, unlike the
  // scalar callStartTime/callEndTime/connected/etc. fields above, which only
  // ever hold the most recent call. Populated going forward by
  // services/leadLifecycle.js; empty for leads that predate this field.
  callLogs: [{
    touchNumber: Number,
    calledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    callDate: Date,
    callStartTime: Date,
    callEndTime: Date,
    callDuration: Number,
    connected: {
      type: String,
      enum: ['Yes', 'No', '', null]
    },
    notConnectedReason: String,
    interestLevel: String,
    remark: String,
    // Stage the lead was in immediately after this call was logged, and an
    // auto-classified call type — both set by services/leadLifecycle.js, not
    // chosen by the caller, so every call log entry stays self-describing
    // without asking the BD an extra question mid-call.
    leadStage: String,
    callType: {
      type: String,
      enum: ['First Call', 'Follow-up', 'Callback', 'Proposal', 'Negotiation', 'Other']
    }
  }],
  // Set once, from the first callLogs entry — used for BD response-time
  // reporting (time from assignment to first call).
  firstCallAt: {
    type: Date
  },

  // ── Follow-Up & Revenue Protection Engine ─────────────────────────────────
  // Escalation tracking for services/followUpEngine.js. All cleared whenever
  // nextFollowUpDate changes (see services/leadLifecycle.js), so rescheduling
  // a follow-up restarts the reminder/escalation cycle cleanly.
  followUpReminderSentAt: { type: Date, default: null },
  followUpDueNotifiedAt: { type: Date, default: null },
  followUpOverdueBDNotifiedAt: { type: Date, default: null },
  followUpOverdueManagerNotifiedAt: { type: Date, default: null },
  followUpBreached: { type: Boolean, default: false },
  followUpBreachedAt: { type: Date, default: null },

  // ── Proposal / Negotiation ────────────────────────────────────────────────
  proposalValue: {
    type: Number,
    min: 0
  },
  proposalSentDate: {
    type: Date
  },
  expectedCloseDate: {
    type: Date
  },
  paymentStatus: {
    type: String,
    enum: ['Not Applicable', 'Pending', 'Partially Paid', 'Paid'],
    default: 'Not Applicable'
  },

  // ── Qualification ─────────────────────────────────────────────────────────
  // Free-form discovery data a BD fills in as the conversation progresses —
  // none of it gates stage transitions (server/utils/leadStateMachine.js is
  // still the only enforcement point for that), it's reference context.
  budget: {
    type: Number,
    min: 0
  },
  timeline: {
    type: String,
    trim: true
  },
  decisionMaker: {
    type: String,
    trim: true
  },
  currentVendor: {
    type: String,
    trim: true
  },
  requirementSummary: {
    type: String,
    trim: true
  },

  // ── Documents ────────────────────────────────────────────────────────────
  // Proposal/quotation/scope files and other attachments. Stored on
  // Cloudinary (see server/utils/cloudinary.js's uploadLeadDocument), pushed
  // via the raw driver in leadController.uploadLeadDocument, same as every
  // other lead write.
  documents: [{
    name: { type: String, trim: true },
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
    docType: { type: String, trim: true },
    isImage: { type: Boolean, default: false },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // ── Hold ──────────────────────────────────────────────────────────────────
  holdReason: {
    type: String,
    trim: true
  },
  holdUntil: {
    type: Date
  },

  // ── Revenue / Deal Tracking ───────────────────────────────────────────────
  dealValue: {
    type: Number,
    default: 0,
    min: 0
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    sparse: true
  },
  closedDate: {
    type: Date
  }
}, { timestamps: true });

// Keep the normalized contact fields in sync so duplicate-lead lookups
// (see server/services/leadDedup.js) stay accurate whenever phone/altPhone/
// email change, however the document was saved.
leadSchema.pre('save', function() {
  if (this.isModified('phone')) this.phoneNormalized = normalizePhone(this.phone);
  if (this.isModified('altPhone')) this.altPhoneNormalized = normalizePhone(this.altPhone);
  if (this.isModified('email')) this.emailNormalized = normalizeEmail(this.email);
});

// Add pre-save hook for auto-generating leadId
leadSchema.pre('save', async function() {
  if (!this.leadId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const dateStr = `${year}${month}${day}`;

    // Find the highest counter issued for this date. Sorting by leadId rather
    // than createdAt matters for imported leads, which carry their original
    // submission date — sorting by createdAt would reissue a used counter and
    // trip the unique index.
    const lastLead = await this.constructor.findOne({
      leadId: new RegExp(`^VH-${dateStr}-`)
    }).sort({ leadId: -1 });

    let counter = 1;
    if (lastLead && lastLead.leadId) {
      const lastCounter = parseInt(lastLead.leadId.split('-')[2], 10);
      if (!isNaN(lastCounter)) {
        counter = lastCounter + 1;
      }
    }

    this.leadId = `VH-${dateStr}-${('000' + counter).slice(-3)}`;
  }
  
  // Set default unassigned SLA (e.g. 2 hours) on creation
  if (this.isNew && !this.assignedTo) {
    this.unassignedSlaDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000);
  }
});

// Add single-field indexes for fast sorting and filtering
leadSchema.index({ status: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ leadId: 1 });
leadSchema.index({ leadType: 1, createdAt: -1 });
leadSchema.index({ fbFormId: 1 });

// Duplicate-detection lookups (see server/services/leadDedup.js) filter by
// these on every incoming lead, so they need real indexes rather than falling
// back to the text index below.
leadSchema.index({ phoneNormalized: 1 });
leadSchema.index({ altPhoneNormalized: 1 });
leadSchema.index({ emailNormalized: 1 });

// Add compound text index for scalable backend searching
leadSchema.index({ fullName: 'text', email: 'text', phone: 'text', leadId: 'text' });

module.exports = mongoose.model('Lead', leadSchema);
