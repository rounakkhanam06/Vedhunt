const mongoose = require('mongoose');

// A client's recurring-invoice schedule (client decision, Oct 2026): a billing day
// chosen per client, billed in advance for the coming month, full fee every time.
// The schedule only produces DRAFTS (InvoiceDraft); an admin approves each one.
const billingScheduleSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, unique: true },
    active: { type: Boolean, default: false },
    // Day of the month to invoice on (1–31; a short month uses its last day)
    billingDay: { type: Number, required: true, min: 1, max: 31 },
    // The first invoice date, 'YYYY-MM-DD'. Suggested as onboarding date + 30 days.
    startDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    // Days the client has to pay after the invoice date (7 or 10 per the client; any 1–30 allowed)
    dueDays: { type: Number, default: 7, min: 1, max: 30 },
    note: { type: String, trim: true, maxlength: 500 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BillingSchedule', billingScheduleSchema);
