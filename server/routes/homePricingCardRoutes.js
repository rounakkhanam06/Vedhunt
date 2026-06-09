const express = require('express');
const router = express.Router();
const { getHomePricingCards, updateHomePricingCard, createHomePricingCard, deleteHomePricingCard } = require('../controllers/homePricingCardController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route to get cards
router.get('/', getHomePricingCards);

// Admin routes
router.post('/', authMiddleware, createHomePricingCard);
router.put('/:id', authMiddleware, updateHomePricingCard);
router.delete('/:id', authMiddleware, deleteHomePricingCard);

module.exports = router;
