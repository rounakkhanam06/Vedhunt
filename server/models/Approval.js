const mongoose = require('mongoose');

// Something the client has to approve before Vedhunt goes ahead: the strategy, the budget, a creative
// (Client Journey SOP §9). Staff raise a request; the client approves or rejects it in the portal, or
// staff record the answer the client gave another way (WhatsApp, email, in person) with that source.
// A decided approval is never edited — a change is a new request.
const KINDS = ['Strategy', 'Budget', 'Creative', 'Other', 'Change request'];
const STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled'];
// Where the answer came from. 'Client portal' is the client's own click; the rest are staff-recorded.
const CHANNELS = ['Client portal', 'WhatsApp', 'Email', 'In person', 'Other'];

const approvalSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    kind: { type: String, enum: KINDS, required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    details: { type: String, trim: true, maxlength: 3000 }, // what exactly is being approved (client sees it)
    versionLabel: { type: String, trim: true, maxlength: 40 }, // e.g. "Strategy v2", "Creative set 3"
    amount: { type: Number, min: 0 }, // for a budget: the monthly amount asked to be approved
    linkUrl: { type: String, trim: true, maxlength: 500 }, // where the client can look at it (creative folder, document)

    status: { type: String, enum: STATUSES, default: 'Pending' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    requestedByName: { type: String, trim: true },
    requestedAt: { type: Date, default: Date.now },

    decidedAt: { type: Date },
    decisionBy: { type: String, enum: ['client', 'staff'] }, // staff = recorded on the client's behalf
    decidedByName: { type: String, trim: true }, // the client's contact, or the staff member who recorded it
    channel: { type: String, enum: CHANNELS },
    receivedAt: { type: Date }, // staff-recorded: the day the client actually answered
    note: { type: String, trim: true, maxlength: 1000 }, // the client's comment / why it was rejected / why it was cancelled
  },
  { timestamps: true }
);

approvalSchema.index({ client_ref: 1, status: 1, requestedAt: -1 });

module.exports = mongoose.model('Approval', approvalSchema);
Object.assign(module.exports, { KINDS, STATUSES, CHANNELS });
