const express = require('express');
const User = require('../models/User');
const PaymentService = require('../services/PaymentService');
const { auth } = require('../middleware/auth');

const router = express.Router();
const paymentService = new PaymentService();

// Get subscription plans
router.get('/plans', (req, res) => {
  try {
    const plans = paymentService.getSubscriptionPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Create payment link
router.post('/create-payment', auth, async (req, res) => {
  try {
    const { planType } = req.body;
    const user = req.user;

    if (!planType || !['monthly', 'yearly'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const paymentData = await paymentService.createPaymentLink(
      user._id.toString(),
      planType,
      user.email
    );

    // Store payment info temporarily (in production, use Redis or database)
    // For now, we'll store it in the user's payment history as pending
    user.paymentHistory.push({
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      currency: 'VND',
      subscriptionType: planType,
      paymentDate: new Date(),
      status: 'pending'
    });
    
    await user.save();

    res.json({
      paymentUrl: paymentData.paymentUrl,
      orderId: paymentData.orderId,
      orderCode: paymentData.orderCode,
      amount: paymentData.amount,
      planType: paymentData.planType
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Không thể tạo link thanh toán' });
  }
});

// Verify payment
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { orderCode, orderId } = req.body;
    const user = req.user;

    if (!orderCode || !orderId) {
      return res.status(400).json({ error: 'Missing payment information' });
    }

    // Verify payment with PayOS
    const paymentInfo = await paymentService.verifyPayment(orderCode);
    
    if (paymentInfo.status === 'PAID') {
      // Find the payment record
      const paymentRecord = user.paymentHistory.find(p => p.orderId === orderId);
      if (!paymentRecord) {
        return res.status(404).json({ error: 'Payment record not found' });
      }

      // Update payment status
      paymentRecord.status = 'completed';
      
      // Update user subscription
      const duration = paymentRecord.subscriptionType === 'yearly' ? 12 : 1;
      user.updateSubscription(paymentRecord.subscriptionType, duration);
      
      await user.save();

      res.json({
        message: 'Thanh toán thành công! Subscription đã được kích hoạt.',
        subscription: user.subscription,
        paymentInfo: {
          orderId,
          amount: paymentInfo.amount,
          status: 'completed'
        }
      });
    } else {
      res.status(400).json({ 
        error: 'Payment not completed',
        status: paymentInfo.status 
      });
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Không thể xác minh thanh toán' });
  }
});

// PayOS webhook
router.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    console.log('PayOS Webhook received:', webhookData);

    const result = await paymentService.handleWebhook(webhookData);
    
    if (result.success) {
      // Find user by order code and update subscription
      // This is a simplified approach - in production, you'd want better order tracking
      const orderCodeStr = result.orderCode.toString();
      const user = await User.findOne({
        'paymentHistory.orderId': { $regex: orderCodeStr }
      });

      if (user) {
        const paymentRecord = user.paymentHistory.find(p => 
          p.orderId.includes(orderCodeStr) && p.status === 'pending'
        );

        if (paymentRecord) {
          paymentRecord.status = 'completed';
          const duration = paymentRecord.subscriptionType === 'yearly' ? 12 : 1;
          user.updateSubscription(paymentRecord.subscriptionType, duration);
          await user.save();
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      paymentHistory: user.paymentHistory.sort((a, b) => 
        new Date(b.paymentDate) - new Date(a.paymentDate)
      )
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;