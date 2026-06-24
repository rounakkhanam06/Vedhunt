const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Public route to get contact info
router.get('/settings/contact', settingsController.getContactInfo);

// Admin route to update contact info
router.put(
  '/admin/settings/contact',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  settingsController.updateContactInfo
);

// Public route to get privacy policy
router.get('/settings/privacy-policy', settingsController.getPrivacyPolicy);

// Admin route to update privacy policy
router.put(
  '/admin/settings/privacy-policy',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  settingsController.updatePrivacyPolicy
);

// Public route to get terms and conditions
router.get('/settings/terms-conditions', settingsController.getTermsConditions);

// Admin route to update terms and conditions
router.put(
  '/admin/settings/terms-conditions',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  settingsController.updateTermsConditions
);

// Public route to get cookie policy
router.get('/settings/cookie-policy', settingsController.getCookiePolicy);

// Admin route to update cookie policy
router.put(
  '/admin/settings/cookie-policy',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  settingsController.updateCookiePolicy
);

// Public route to get DPA policy
router.get('/settings/dpa', settingsController.getDPA);

// Admin route to update DPA policy
router.put(
  '/admin/settings/dpa',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  settingsController.updateDPA
);

// Public route to get Refund Policy
router.get('/settings/refund-policy', settingsController.getRefundPolicy);

// Admin route to update Refund Policy
router.put(
  '/admin/settings/refund-policy',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  settingsController.updateRefundPolicy
);

// Public route to get Facebook Settings
router.get('/settings/facebook', settingsController.getFacebookSettings);

// Admin route to update Facebook Settings
router.put(
  '/admin/settings/facebook',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  settingsController.updateFacebookSettings
);

// Public route to get Campaign Settings
router.get('/settings/campaigns', settingsController.getCampaignSettings);

// Admin route to update Campaign Settings
router.put(
  '/admin/settings/campaigns',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  settingsController.updateCampaignSettings
);

// Public route to get Email Settings
router.get('/settings/email', settingsController.getEmailSettings);

// Admin route to update Email Settings
router.put(
  '/admin/settings/email',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  settingsController.updateEmailSettings
);

// Public route to get Office Timings
router.get('/settings/office-timings', settingsController.getOfficeTimings);

// Admin route to update Office Timings
router.put(
  '/admin/settings/office-timings',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  settingsController.updateOfficeTimings
);

// Public route to get Attendance Rules
router.get('/settings/attendance-rules', settingsController.getAttendanceRules);

// Admin route to update Attendance Rules
router.put(
  '/admin/settings/attendance-rules',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  settingsController.updateAttendanceRules
);

module.exports = router;
