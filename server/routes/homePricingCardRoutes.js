const express = require('express');
const router = express.Router();
const { getHomePricingCards, updateHomePricingCard } = require('../controllers/homePricingCardController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route to get cards
router.get('/', getHomePricingCards);

// Admin route to update a card
router.put('/:id', authMiddleware, updateHomePricingCard);

module.exports = router;
