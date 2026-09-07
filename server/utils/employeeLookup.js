const mongoose = require('mongoose');

/**
 * Some legacy Employee (and linked Admin) documents were created with a
 * String _id instead of a proper ObjectId — same class of issue as Lead
 * documents (see utils/leadLookup.js). A plain Mongoose .findById() silently
 * returns null for those, because Mongoose casts the query value to
 * ObjectId before it ever reaches Mongo.
 *
 * This tries the id as-is first, then as an ObjectId, via the raw driver —
 * so it works for both old and new records. Returns a plain object (not a
 * Mongoose document).
 */
async function findRawById(collectionName, id, extraFilter = {}) {
  const db = mongoose.connection.db;
  let doc = await db.collection(collectionName).findOne({ _id: id, ...extraFilter });
  if (!doc && mongoose.Types.ObjectId.isValid(id)) {
    doc = await db.collection(collectionName).findOne({ _id: new mongoose.Types.ObjectId(id), ...extraFilter });
  }
  return doc;
}

const findEmployeeRaw = (id, extraFilter = {}) => findRawById('employees', id, extraFilter);
const findAdminRaw = (id, extraFilter = {}) => findRawById('admins', id, extraFilter);

module.exports = { findEmployeeRaw, findAdminRaw };
