const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
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
  adCampaignId: {
    type: String,
    trim: true
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
  bd: {
    type: String,
    trim: true
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
  notConnectedReason: {
    type: String,
    trim: true
  },
  interestLevel: {
    type: String,
    trim: true
  },
  notConvertedReason: {
    type: String,
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
    enum: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Dropped'],
    default: 'New'
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

// Add pre-save hook for auto-generating leadId
leadSchema.pre('save', async function() {
  if (!this.leadId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const dateStr = `${year}${month}${day}`;

    // Find the last lead created today to increment the counter
    const lastLead = await this.constructor.findOne({
      leadId: new RegExp(`^VH-${dateStr}-`)
    }).sort({ createdAt: -1 });

    let counter = 1;
    if (lastLead && lastLead.leadId) {
      const lastCounter = parseInt(lastLead.leadId.split('-')[2], 10);
      if (!isNaN(lastCounter)) {
        counter = lastCounter + 1;
      }
    }

    this.leadId = `VH-${dateStr}-${('000' + counter).slice(-3)}`;
  }
});

// Add single-field indexes for fast sorting and filtering
leadSchema.index({ status: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ leadId: 1 });

// Add compound text index for scalable backend searching
leadSchema.index({ fullName: 'text', email: 'text', phone: 'text', leadId: 'text' });

module.exports = mongoose.model('Lead', leadSchema);
