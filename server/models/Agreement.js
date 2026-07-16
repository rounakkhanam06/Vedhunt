const mongoose = require('mongoose');

const agreementSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, 'Agreement content is required'],
    },
    version: {
      type: Number,
      default: 1,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

const Agreement = mongoose.model('Agreement', agreementSchema);
module.exports = Agreement;
