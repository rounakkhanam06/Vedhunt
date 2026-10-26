const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const portalLegalController = require('../controllers/portalLegalController');
const activityMaster = require('../services/activityMaster');
const clientEmailPolicy = require('../services/clientEmailPolicy');
const clientPolicies = require('../services/clientPolicies');
const { runAutoHold } = require('../services/autoHold');
const { recordAudit } = require('../services/audit');

// Public route to get contact info
router.get('/settings/contact', settingsController.getContactInfo);

// Admin route to update contact info
router.put(
  '/admin/settings/contact',
  authMiddleware,
  requirePermission('settings.manage'),
  settingsController.updateContactInfo
);

// Public route to get privacy policy
router.get('/settings/privacy-policy', settingsController.getPrivacyPolicy);

// Admin route to update privacy policy
router.put(
  '/admin/settings/privacy-policy',
  authMiddleware,
  requirePermission('legal.manage'),
  settingsController.updatePrivacyPolicy
);

// Public route to get terms and conditions
router.get('/settings/terms-conditions', settingsController.getTermsConditions);

// Admin route to update terms and conditions
router.put(
  '/admin/settings/terms-conditions',
  authMiddleware,
  requirePermission('legal.manage'),
  settingsController.updateTermsConditions
);

// Public route to get cookie policy
router.get('/settings/cookie-policy', settingsController.getCookiePolicy);

// Admin route to update cookie policy
router.put(
  '/admin/settings/cookie-policy',
  authMiddleware,
  requirePermission('legal.manage'),
  settingsController.updateCookiePolicy
);

// Public route to get DPA policy
router.get('/settings/dpa', settingsController.getDPA);

// Admin route to update DPA policy
router.put(
  '/admin/settings/dpa',
  authMiddleware,
  requirePermission('legal.manage'),
  settingsController.updateDPA
);

// Public route to get Refund Policy
router.get('/settings/refund-policy', settingsController.getRefundPolicy);

// Admin route to update Refund Policy
router.put(
  '/admin/settings/refund-policy',
  authMiddleware,
  requirePermission('legal.manage'),
  settingsController.updateRefundPolicy
);

// Public route to get Facebook Settings
router.get('/settings/facebook', settingsController.getFacebookSettings);

// Admin route to update Facebook Settings
router.put(
  '/admin/settings/facebook',
  authMiddleware,
  requirePermission('settings.manage'),
  settingsController.updateFacebookSettings
);

// Public route to get Campaign Settings
router.get('/settings/campaigns', settingsController.getCampaignSettings);

// Admin route to update Campaign Settings
router.put(
  '/admin/settings/campaigns',
  authMiddleware,
  requirePermission('settings.manage'),
  settingsController.updateCampaignSettings
);

// Public route to get Email Settings
// Internal configuration — only the Settings page reads it (the server reads the DB directly)
router.get('/settings/email', authMiddleware, requirePermission('settings.manage'), settingsController.getEmailSettings);

// Admin route to update Email Settings
router.put(
  '/admin/settings/email',
  authMiddleware,
  requirePermission('settings.manage'),
  settingsController.updateEmailSettings
);

// Public route to get Office Timings
// Internal configuration — only the Settings page reads it (the server reads the DB directly)
router.get('/settings/office-timings', authMiddleware, requirePermission('settings.manage'), settingsController.getOfficeTimings);

// Admin route to update Office Timings
router.put(
  '/admin/settings/office-timings',
  authMiddleware,
  requirePermission('settings.manage'),
  settingsController.updateOfficeTimings
);

// Public route to get Attendance Rules
// Internal configuration — only the Settings page reads it (the server reads the DB directly)
router.get('/settings/attendance-rules', authMiddleware, requirePermission('settings.manage'), settingsController.getAttendanceRules);

// Admin route to update Attendance Rules
router.put(
  '/admin/settings/attendance-rules',
  authMiddleware,
  requirePermission('settings.manage'),
  settingsController.updateAttendanceRules
);

// Public route to get Payment Settings
router.get('/settings/payment', settingsController.getPaymentSettings);

// Admin route to update Payment Settings
router.put(
  '/admin/settings/payment',
  authMiddleware,
  requirePermission('settings.manage'),
  settingsController.updatePaymentSettings
);

// Public route to get Support Categories
router.get('/settings/support-categories', settingsController.getSupportCategories);

// Admin route to update Support Categories
router.put(
  '/admin/settings/support-categories',
  authMiddleware,
  requirePermission('cms.manage'),
  settingsController.updateSupportCategories
);

// Client Portal / Employee Portal Terms & Privacy (separate from the website's)
// :doc = client-terms | client-privacy | employee-terms | employee-privacy
// Public read: the login pages link to these before anyone is signed in.
router.get('/settings/portal-legal/:doc', portalLegalController.getPortalLegal);
router.put(
  '/admin/settings/portal-legal/:doc',
  authMiddleware,
  requirePermission('legal.manage'),
  portalLegalController.updatePortalLegal
);

// Activity master for the work timer/timesheet (HR-managed)
router.get('/admin/settings/activity-master', authMiddleware, requirePermission(['settings.manage', 'tasks.manage']), async (req, res) => {
  res.json({ success: true, types: await activityMaster.getActivityTypes() });
});

router.put('/admin/settings/activity-master', authMiddleware, requirePermission(['settings.manage', 'tasks.manage']), async (req, res) => {
  const { types, error } = await activityMaster.saveActivityTypes(req.body.types);
  if (error) return res.status(400).json({ success: false, message: error });
  res.json({ success: true, types });
});

// Which client notifications are also emailed (the bell always gets all of them)
router.get('/admin/settings/client-email-notifications', authMiddleware, requirePermission(['settings.manage', 'cms.manage']), async (req, res) => {
  res.json({ success: true, events: clientEmailPolicy.EVENTS, policy: await clientEmailPolicy.getEmailPolicy() });
});

router.put('/admin/settings/client-email-notifications', authMiddleware, requirePermission(['settings.manage', 'cms.manage']), async (req, res) => {
  const { policy, error } = await clientEmailPolicy.saveEmailPolicy(req.body.policy);
  if (error) return res.status(400).json({ success: false, message: error });
  res.json({ success: true, events: clientEmailPolicy.EVENTS, policy });
});

// Super Admin rules: when an unpaid client goes on hold, and how extra retainer hours are billed.
// Only a Super Admin ('*') can read or change them.
router.get('/admin/settings/client-policies', authMiddleware, requirePermission('*'), async (req, res) => {
  res.json({ success: true, autoHold: await clientPolicies.getAutoHold(), extraHours: await clientPolicies.getExtraHours(), billing: await clientPolicies.getBilling() });
});

router.put('/admin/settings/client-policies', authMiddleware, requirePermission('*'), async (req, res) => {
  try {
    const before = { autoHold: await clientPolicies.getAutoHold(), extraHours: await clientPolicies.getExtraHours(), billing: await clientPolicies.getBilling() };
    const out = {};
    if (req.body.autoHold !== undefined) {
      const { value, error } = clientPolicies.validateAutoHold(req.body.autoHold);
      if (error) return res.status(400).json({ success: false, message: error });
      out.autoHold = await clientPolicies.saveAutoHold(value);
    }
    if (req.body.extraHours !== undefined) {
      const { value, error } = clientPolicies.validateExtraHours(req.body.extraHours);
      if (error) return res.status(400).json({ success: false, message: error });
      out.extraHours = await clientPolicies.saveExtraHours(value);
    }
    if (req.body.billing !== undefined) {
      const { value, error } = clientPolicies.validateBilling(req.body.billing);
      if (error) return res.status(400).json({ success: false, message: error });
      out.billing = await clientPolicies.saveBilling(value);
    }
    if (!Object.keys(out).length) return res.status(400).json({ success: false, message: 'Nothing to save.' });
    await recordAudit(req, 'CLIENT_POLICY_UPDATE', 'Settings', 'client-policies', before, { ...before, ...out });
    res.json({ success: true, autoHold: out.autoHold || before.autoHold, extraHours: out.extraHours || before.extraHours, billing: out.billing || before.billing });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Run the overdue-payment check right now (the same pass the daily job does)
router.post('/admin/settings/client-policies/run-auto-hold', authMiddleware, requirePermission('*'), async (req, res) => {
  try {
    const result = await runAutoHold();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
