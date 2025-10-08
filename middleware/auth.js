const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN' 
      });
    }

    // Use JWT_ACCESS_SECRET to match the token generation
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id); // Use 'id' not 'userId'
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token.',
        code: 'INVALID_TOKEN' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired. Please login again.',
        code: 'TOKEN_EXPIRED' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token format.',
        code: 'INVALID_TOKEN' 
      });
    }
    
    res.status(401).json({ 
      error: 'Authentication failed.',
      code: 'AUTH_FAILED' 
    });
  }
};

const checkSubscription = async (req, res, next) => {
  try {
    const user = req.user;
    
    console.log('Checking subscription for user:', user.email);
    console.log('User subscription:', user.subscription);
    console.log('Can use trial:', user.canUseTrial());
    console.log('Is subscription active:', user.isSubscriptionActive);
    
    // Check if user can use trial
    if (user.canUseTrial()) {
      console.log('User can use trial, allowing access');
      return next();
    }
    
    // Check if subscription is active
    if (!user.isSubscriptionActive) {
      console.log('Subscription not active, denying access');
      return res.status(403).json({ 
        error: 'Subscription required',
        message: 'Bạn cần đăng ký gói subscription để sử dụng tính năng này.',
        subscriptionStatus: user.subscription.type
      });
    }
    
    console.log('Subscription active, allowing access');
    next();
  } catch (error) {
    console.error('Error in checkSubscription middleware:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};

module.exports = { auth, checkSubscription };