const LeadForm = require('../models/LeadForm');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');

/**
 * @desc    List every Facebook/Instagram Instant Form that has sent us a lead
 * @route   GET /api/admin/lead-forms
 * @access  Private (Admin)
 */
exports.getLeadForms = async (req, res) => {
  try {
    // Unclassified forms first — those are the ones needing attention.
    const forms = await LeadForm.find().sort({ isClassified: 1, lastLeadAt: -1 });

    res.status(200).json({
      success: true,
      count: forms.length,
      unclassifiedCount: forms.filter((f) => !f.isClassified).length,
      data: forms
    });
  } catch (error) {
    logger.error('Error fetching lead forms:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching lead forms' });
  }
};

/**
 * @desc    Set whether a form produces Sales or Hiring leads
 * @route   PUT /api/admin/lead-forms/:id
 * @access  Private (Super Admin / Editor)
 */
exports.updateLeadForm = async (req, res) => {
  try {
    const { leadType, name } = req.body;

    if (leadType && !['Sales', 'Hiring'].includes(leadType)) {
      return res.status(400).json({ success: false, message: 'leadType must be Sales or Hiring' });
    }

    const form = await LeadForm.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Lead form not found' });
    }

    if (typeof name === 'string' && name.trim()) form.name = name.trim();

    let reclassifiedCount = 0;
    if (leadType && leadType !== form.leadType) {
      form.leadType = leadType;

      // Leads already captured under the old classification have to move with
      // it, otherwise reclassifying a form leaves its history in the wrong tab.
      const result = await Lead.updateMany({ fbFormId: form.formId }, { $set: { leadType } });
      reclassifiedCount = result.modifiedCount || 0;
    }

    form.isClassified = true;
    await form.save();

    logger.info(
      `Lead form "${form.name || form.formId}" set to ${form.leadType}; ` +
      `${reclassifiedCount} existing lead(s) reclassified`
    );

    res.status(200).json({ success: true, data: form, reclassifiedCount });
  } catch (error) {
    logger.error('Error updating lead form:', error);
    res.status(500).json({ success: false, message: 'Server error while updating lead form' });
  }
};
