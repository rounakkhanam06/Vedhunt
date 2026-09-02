const PayrollRun = require('../models/PayrollRun');
const logger = require('../utils/logger');
const { generateDraftRunsForMonth, getPayrollSettings } = require('./payrollEngine');
const { finalizeAndSendPayslip } = require('./payslipGenerator');

/** Previous calendar month relative to `now`, as {month: 1-12, year}. */
function previousMonth(now) {
  const m = now.getMonth(); // 0-11
  return m === 0 ? { month: 12, year: now.getFullYear() - 1 } : { month: m, year: now.getFullYear() };
}

/**
 * Runs once a day (see server/services/cronJobs.js). Two independent
 * responsibilities, both idempotent so a missed tick or a same-day server
 * restart never double-processes anything:
 *
 * 1. On the 1st of the month: open the HR review window by calculating
 *    Draft PayrollRuns for the month that just ended.
 * 2. On payroll_settings.generationDay (re-read fresh every tick — this is
 *    the entire mechanism behind "admin can change the date" with no code
 *    change or restart): guarantee every employee's payslip for the target
 *    month goes out. Ensures Drafts exist first (covers a missed 1st-of-
 *    month tick), then — if autoApproveOnGenerationDay is on — auto-
 *    approves anything still Draft/UnderReview (skipping OnHold) so it
 *    never ships late just because HR hadn't gotten to it.
 */
async function runPayrollTick(now = new Date()) {
  const target = previousMonth(now);

  if (now.getDate() === 1) {
    logger.info(`Payroll: opening review window for ${target.month}/${target.year}`);
    await generateDraftRunsForMonth(target.month, target.year);
  }

  const settings = await getPayrollSettings();
  if (now.getDate() !== settings.generationDay) return;

  logger.info(`Payroll: generation day (${settings.generationDay}) reached for ${target.month}/${target.year}`);

  // Safety net — covers a missed 1st-of-month tick (e.g. server was down).
  await generateDraftRunsForMonth(target.month, target.year);

  if (settings.autoApproveOnGenerationDay) {
    const pending = await PayrollRun.find({
      month: target.month,
      year: target.year,
      status: { $in: ['Draft', 'UnderReview'] }
    });
    for (const run of pending) {
      try {
        await finalizeAndSendPayslip(run, { approvedBy: null });
      } catch (error) {
        logger.error(`Payroll: auto-approve failed for run ${run._id}:`, error);
      }
    }
    if (pending.length) logger.info(`Payroll: auto-approved and sent ${pending.length} payslip(s) for ${target.month}/${target.year}`);
  }

  // Anything already Approved earlier (e.g. HR approved manually, but the
  // email failed at the time) — nudge it along too, on the off chance it
  // never made it past Generated. Sent runs are skipped by construction.
  const stillPending = await PayrollRun.find({ month: target.month, year: target.year, status: { $in: ['Approved', 'Generated'] } });
  for (const run of stillPending) {
    try {
      await finalizeAndSendPayslip(run, { approvedBy: run.approvedBy });
    } catch (error) {
      logger.error(`Payroll: retry send failed for run ${run._id}:`, error);
    }
  }
}

module.exports = { runPayrollTick };
