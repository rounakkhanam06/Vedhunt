const express = require('express');
const router = express.Router();
const {
    getFaqContent,
    updateFaqContent,
    getFaqs,
    createFaq,
    updateFaq,
    deleteFaq
} = require('../controllers/faqController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Public routes
router.get('/content', getFaqContent);
router.get('/', getFaqs);

// Protected routes
// FAQ Page in the Admin panel
router.use(authMiddleware, requirePermission('cms.manage'));
router.put('/content', updateFaqContent);
router.post('/', createFaq);
router.put('/:id', updateFaq);
router.delete('/:id', deleteFaq);

module.exports = router;
