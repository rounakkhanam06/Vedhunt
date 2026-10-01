const crypto = require('crypto');
const logger = require('../utils/logger');
const { runImport } = require('./leadImport');

/**
 * In-memory registry of running/finished lead imports. The upload request
 * returns a jobId straight away and the client polls GET /leads/import/:jobId,
 * so a large sheet never holds an HTTP request open past the gateway timeout
 * (that used to surface as a 504 while the import kept running server-side).
 *
 * Kept in process memory on purpose: jobs are short-lived and only the
 * uploader polls them. A server restart mid-import loses the progress record
 * (rows already processed stay saved; re-uploading is safe because existing
 * leads are upserted, not duplicated).
 */
const jobs = new Map();
const JOB_TTL_MS = 60 * 60 * 1000; // finished jobs are kept for an hour

function pruneOldJobs() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.finishedAt && job.finishedAt < cutoff) jobs.delete(id);
  }
}

/** Starts runImport in the background and returns the new job's id. */
function startImportJob(prepared, originalName, actor) {
  pruneOldJobs();

  const id = crypto.randomUUID();
  const job = {
    id,
    ownerId: String(actor?.id || ''),
    fileName: originalName,
    status: 'running',
    rowCount: prepared.rowCount,
    processed: 0,
    summary: { totalRows: 0, imported: 0, updated: 0, invalid: [] },
    error: null,
    finishedAt: null
  };
  jobs.set(id, job);

  runImport(prepared, originalName, actor, ({ processed, totalRows, imported, updated, invalid }) => {
    job.processed = processed;
    job.summary = { totalRows, imported, updated, invalid };
  })
    .then((summary) => {
      job.summary = summary;
      job.processed = job.rowCount;
      job.status = 'completed';
    })
    .catch((err) => {
      logger.error(`Lead import job ${id} (${originalName}) failed:`, err);
      job.status = 'failed';
      job.error = err.message || 'Import failed';
    })
    .finally(() => {
      job.finishedAt = Date.now();
    });

  return id;
}

function getImportJob(id) {
  return jobs.get(id) || null;
}

module.exports = { startImportJob, getImportJob };
