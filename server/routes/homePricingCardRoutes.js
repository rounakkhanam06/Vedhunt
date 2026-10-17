const express = require('express');
const router = express.Router();
const { getHomePricingCards, updateHomePricingCard, createHomePricingCard, deleteHomePricingCard } = require('../controllers/homePricingCardController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Public route to get cards
router.get('/', getHomePricingCards);

// Admin routes
router.post('/', authMiddleware, requirePermission('pricing.manage'), createHomePricingCard);
router.put('/:id', authMiddleware, requirePermission('pricing.manage'), updateHomePricingCard);
router.delete('/:id', authMiddleware, requirePermission('pricing.manage'), deleteHomePricingCard);

module.exports = router;
