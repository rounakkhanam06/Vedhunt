const express = require('express');
const router = express.Router();
const { submitContactForm } = require('../controllers/contactController');

// Public route to submit contact form
router.post('/', submitContactForm);

module.exports = router;
