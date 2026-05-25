const express = require('express');
const router = express.Router();
const {
  getPortfolioItems,
  getAllAdminPortfolioItems,
  getPortfolioItem,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem
} = require('../controllers/portfolioController');
const protect = require('../middleware/authMiddleware');

router.route('/')
  .get(getPortfolioItems)
  .post(protect, createPortfolioItem);

router.route('/admin')
  .get(protect, getAllAdminPortfolioItems);

router.route('/:id')
  .get(getPortfolioItem)
  .put(protect, updatePortfolioItem)
  .delete(protect, deletePortfolioItem);

module.exports = router;
