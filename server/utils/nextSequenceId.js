/**
 * Next "PREFIX-0001" style ID for a model: the highest existing number + 1.
 *
 * Never "how many documents + 1": once a record is deleted the count drops and
 * hands out an ID that is still in use, and the unique index then rejects
 * every new record (the duplicate VH-CL-0020 after a client was permanently
 * deleted).
 *
 * @param {import('mongoose').Model} Model
 * @param {string} field   e.g. 'clientId'
 * @param {string} prefix  e.g. 'VH-CL-'
 */
async function nextSequenceId(Model, field, prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const [top] = await Model.aggregate([
    { $match: { [field]: new RegExp(`^${escaped}\\d+$`) } },
    { $project: { n: { $toInt: { $substrCP: [`$${field}`, prefix.length, 12] } } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  return `${prefix}${String((top?.n || 0) + 1).padStart(4, '0')}`;
}

module.exports = { nextSequenceId };
