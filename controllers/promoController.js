const PromoCode = require('../models/PromoCode');
const User = require('../models/User');

/**
 * @desc    Apply promo code to activate premium
 * @route   POST /api/promo/apply
 * @access  Private
 */
exports.applyPromoCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    if (!code) {
      return res.status(400).json({ message: 'Vui lòng nhập mã khuyến mãi.' });
    }

    // Find promo code
    const promoCode = await PromoCode.findOne({ code: code.toUpperCase() });

    if (!promoCode) {
      return res.status(404).json({ message: 'Mã khuyến mãi không tồn tại.' });
    }

    // Validate promo code
    if (!promoCode.isValid()) {
      return res.status(400).json({ message: 'Mã khuyến mãi đã hết hạn hoặc không còn hiệu lực.' });
    }

    // Check if user already used this code
    if (promoCode.hasUserUsed(userId)) {
      return res.status(400).json({ message: 'Bạn đã sử dụng mã khuyến mãi này rồi.' });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại.' });
    }

    // Calculate new subscription dates
    const now = new Date();
    let startDate = now;
    let endDate = new Date(now);

    // If user already has active subscription, extend from current end date
    if (user.subscription && user.subscription.isActive && user.subscription.endDate > now) {
      startDate = user.subscription.endDate;
      endDate = new Date(startDate);
    }

    // Add duration based on promo code type
    if (promoCode.type === 'lifetime') {
      endDate = new Date('2099-12-31'); // Set far future date for lifetime
    } else {
      endDate.setMonth(endDate.getMonth() + promoCode.duration);
    }

    // Update user subscription
    user.subscription = {
      type: promoCode.type,
      isActive: true,
      startDate: startDate,
      endDate: endDate,
      autoRenew: false, // Promo codes don't auto-renew
      paymentMethod: 'promo_code'
    };

    // Reset trial if not used
    if (!user.usage.trialUsed) {
      user.usage.trialUsed = false;
    }

    await user.save();

    // Update promo code usage
    promoCode.usedCount += 1;
    promoCode.usedBy.push({
      userId: userId,
      usedAt: now
    });
    await promoCode.save();

    res.status(200).json({
      message: 'Kích hoạt Premium thành công!',
      subscription: user.subscription,
      promoType: promoCode.type,
      duration: promoCode.type === 'lifetime' ? 'Vĩnh viễn' : `${promoCode.duration} tháng`
    });

  } catch (error) {
    console.error('Error applying promo code:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

/**
 * @desc    Create new promo code (Admin only)
 * @route   POST /api/promo/create
 * @access  Private/Admin
 */
exports.createPromoCode = async (req, res) => {
  try {
    const { code, type, duration, maxUses, expiresAt } = req.body;

    // Validate input
    if (!code || !type || !duration) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin.' });
    }

    // Check if code already exists
    const existingCode = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json({ message: 'Mã khuyến mãi đã tồn tại.' });
    }

    // Create new promo code
    const promoCode = await PromoCode.create({
      code: code.toUpperCase(),
      type,
      duration,
      maxUses: maxUses || 1,
      expiresAt: expiresAt || null,
      createdBy: req.user._id
    });

    res.status(201).json({
      message: 'Tạo mã khuyến mãi thành công!',
      promoCode: {
        code: promoCode.code,
        type: promoCode.type,
        duration: promoCode.duration,
        maxUses: promoCode.maxUses,
        expiresAt: promoCode.expiresAt
      }
    });

  } catch (error) {
    console.error('Error creating promo code:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

/**
 * @desc    Get all promo codes (Admin only)
 * @route   GET /api/promo/list
 * @access  Private/Admin
 */
exports.getAllPromoCodes = async (req, res) => {
  try {
    const promoCodes = await PromoCode.find()
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      count: promoCodes.length,
      promoCodes
    });

  } catch (error) {
    console.error('Error getting promo codes:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

/**
 * @desc    Delete promo code (Admin only)
 * @route   DELETE /api/promo/:id
 * @access  Private/Admin
 */
exports.deletePromoCode = async (req, res) => {
  try {
    const promoCode = await PromoCode.findByIdAndDelete(req.params.id);

    if (!promoCode) {
      return res.status(404).json({ message: 'Mã khuyến mãi không tồn tại.' });
    }

    res.status(200).json({ message: 'Xóa mã khuyến mãi thành công!' });

  } catch (error) {
    console.error('Error deleting promo code:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
