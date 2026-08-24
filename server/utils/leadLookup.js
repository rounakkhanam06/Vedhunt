const mongoose = require('mongoose');

/**
 * Some legacy Lead documents were imported with a String _id instead of a
 * proper ObjectId (see leadController.updateLead's original "handles both
 * String and ObjectId" workaround for the same issue). A plain Mongoose
 * .findById()/.findOne({_id}) silently returns null for those, because
 * Mongoose casts the query value to ObjectId before it ever reaches Mongo.
 *
 * This tries the id as-is first, then as an ObjectId, via the raw driver —
 * so it works for both old and new leads. Returns a plain object (not a
 * Mongoose document): a lead fetched this way must be written back through
 * the raw driver too (see leadAssignment.js's applyAssignment), never via
 * .save(), which hits the exact same casting problem on the write side.
 */
async function findLeadRaw(id, extraFilter = {}) {
  const db = mongoose.connection.db;
  let doc = await db.collection('leads').findOne({ _id: id, ...extraFilter });
  if (!doc && mongoose.Types.ObjectId.isValid(id)) {
    doc = await db.collection('leads').findOne({ _id: new mongoose.Types.ObjectId(id), ...extraFilter });
  }
  return doc;
}

module.exports = { findLeadRaw };
