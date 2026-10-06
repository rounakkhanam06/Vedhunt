const Invoice = require('../models/Invoice');
const Project = require('../models/Project');

/**
 * Earned / pending for one invoice. An invoice marked Paid counts as fully
 * collected even if paidAmount was never filled in (the admin status
 * dropdown used to set only the status); otherwise earned = paidAmount and
 * pending = whatever is still owed.
 */
function invoiceMoney(inv) {
  const total = Number(inv.totalAmount) || 0;
  const paid = Number(inv.paidAmount) || 0;
  if (inv.paymentStatus === 'Paid') return { earned: Math.max(total, paid), pending: 0 };
  return { earned: paid, pending: Math.max(0, total - paid) };
}

exports.getFinancialOverview = async (req, res) => {
  try {
    const [invoices, projects] = await Promise.all([
      Invoice.find({}, { totalAmount: 1, paidAmount: 1, paymentStatus: 1, project_ref: 1 }).lean(),
      Project.find({}, { projectId: 1, projectName: 1, client_ref: 1, totalPrice: 1, status: 1 })
        .populate('client_ref', 'businessName contactName').lean(),
    ]);

    // 1. Overall earnings & pending, plus per-project totals in the same pass
    let totalRevenue = 0;
    let totalPending = 0;
    const byProject = new Map();
    for (const inv of invoices) {
      const { earned, pending } = invoiceMoney(inv);
      totalRevenue += earned;
      totalPending += pending;
      if (inv.project_ref) {
        const key = String(inv.project_ref);
        const sum = byProject.get(key) || { paid: 0, pending: 0 };
        sum.paid += earned;
        sum.pending += pending;
        byProject.set(key, sum);
      }
    }

    // 2. Project breakdown
    const projectStats = projects.map((proj) => {
      const sums = byProject.get(String(proj._id)) || { paid: 0, pending: 0 };
      return {
        _id: proj._id,
        projectId: proj.projectId,
        projectName: proj.projectName,
        clientName: proj.client_ref ? (proj.client_ref.businessName || proj.client_ref.contactName) : 'Unknown',
        totalPrice: proj.totalPrice || 0,
        paidAmount: sums.paid,
        pendingAmount: sums.pending,
        status: proj.status
      };
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalRevenue,
          totalPending,
          totalInvoices: invoices.length,
          totalProjects: projects.length,
          activeProjects: projects.filter((p) => p.status === 'Active').length
        },
        projectStats
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching analytics' });
  }
};

exports.invoiceMoney = invoiceMoney; // exported for tests
