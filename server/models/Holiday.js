const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true // Usually one holiday per date, though there could be edge cases, keeping unique for simplicity
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['Public', 'Restricted'],
      default: 'Public'
    }
  },
  { timestamps: true }
);

const Holiday = mongoose.model('Holiday', holidaySchema);

module.exports = Holiday;
