const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');
const promoController = require('../controllers/promoController');

// Apply promo code (User)
router.post('/apply', auth, promoController.applyPromoCode);

// Create promo code (Admin only)
router.post('/create', auth, admin, promoController.createPromoCode);

// Get all promo codes (Admin only)
router.get('/list', auth, admin, promoController.getAllPromoCodes);

// Delete promo code (Admin only)
router.delete('/:id', auth, admin, promoController.deletePromoCode);

module.exports = router;
