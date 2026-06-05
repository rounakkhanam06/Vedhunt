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

// Public routes
router.get('/content', getFaqContent);
router.get('/', getFaqs);

// Protected routes
router.use(authMiddleware);
router.put('/content', updateFaqContent);
router.post('/', createFaq);
router.put('/:id', updateFaq);
router.delete('/:id', deleteFaq);

module.exports = router;
