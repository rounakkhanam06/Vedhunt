const Invoice = require('../models/Invoice');
const Project = require('../models/Project');

exports.getFinancialOverview = async (req, res) => {
  try {
    // 1. Overall Earnings & Pending (from all Invoices)
    const invoices = await Invoice.find().lean();
    let totalRevenue = 0;
    let totalPending = 0;

    invoices.forEach(inv => {
      totalRevenue += (inv.paidAmount || 0);
      const remaining = Math.max(0, inv.totalAmount - (inv.paidAmount || 0));
      if (inv.paymentStatus !== 'Paid') {
        totalPending += remaining;
      }
    });

    // 2. Project Breakdown
    const projects = await Project.find().populate('client_ref', 'businessName contactName').lean();
    
    const projectStats = projects.map(proj => {
      const projInvoices = invoices.filter(inv => inv.project_ref && inv.project_ref.toString() === proj._id.toString());
      
      let projPaid = 0;
      let projPending = 0;
      
      projInvoices.forEach(inv => {
        projPaid += (inv.paidAmount || 0);
        const rem = Math.max(0, inv.totalAmount - (inv.paidAmount || 0));
        if (inv.paymentStatus !== 'Paid') {
          projPending += rem;
        }
      });
      
      return {
        _id: proj._id,
        projectId: proj.projectId,
        projectName: proj.projectName,
        clientName: proj.client_ref ? (proj.client_ref.businessName || proj.client_ref.contactName) : 'Unknown',
        totalPrice: proj.totalPrice || 0,
        paidAmount: projPaid,
        pendingAmount: projPending,
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
          totalProjects: projects.length
        },
        projectStats
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching analytics' });
  }
};
