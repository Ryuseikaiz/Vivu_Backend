// Vercel serverless function entry point
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('../config/passport');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://vivuvivu.vercel.app', 'https://vivubackend.vercel.app']
    : ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session middleware for passport
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Connect to MongoDB
if (!mongoose.connection.readyState) {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many search requests, please try again later.'
});

// Import routes
const authRoutes = require('../routes/auth');
const blogRoutes = require('../routes/blog');
const locationRoutes = require('../routes/location');
const paymentRoutes = require('../routes/payment');
const promoRoutes = require('../routes/promo');
const uploadRoutes = require('../routes/upload');
const facebookRoutes = require('../routes/facebook');

// Import middleware
const { auth, checkSubscription } = require('../middleware/auth');

// Import services
const TravelAgent = require('../services/TravelAgent');
const EmailService = require('../services/EmailService');

const travelAgent = new TravelAgent();
const emailService = new EmailService();

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/facebook', facebookRoutes);

// Travel search route
const { v4: uuidv4 } = require('uuid');
const sessions = new Map();

app.post('/api/travel/search', searchLimiter, auth, checkSubscription, async (req, res) => {
  try {
    const { query, metadata = {} } = req.body;
    const user = req.user;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const threadId = uuidv4();
    
    if (user.canUseTrial()) {
      user.useTrial();
      await user.save();
    } else {
      user.usage.searchCount += 1;
      user.usage.lastSearchDate = new Date();
      await user.save();
    }
    
    const travelInfo = await travelAgent.processQuery(query, threadId, metadata);
    
    sessions.set(threadId, {
      query,
      metadata,
      travelInfo,
      timestamp: new Date(),
      userId: user._id
    });

    res.json({
      travelInfo,
      threadId,
      usage: {
        searchCount: user.usage.searchCount,
        trialUsed: user.usage.trialUsed,
        subscriptionActive: user.isSubscriptionActive
      }
    });
  } catch (error) {
    console.error('Error processing travel query:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Email route
app.post('/api/travel/send-email', auth, async (req, res) => {
  try {
    const { travelInfo, threadId } = req.body;
    const user = req.user;
    
    if (!travelInfo || !user.email) {
      return res.status(400).json({ error: 'Travel info and email are required' });
    }
    
    await emailService.sendTravelPlan(user.email, user.name, travelInfo);
    
    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Vivu Backend API',
    timestamp: new Date().toISOString() 
  });
});

// Export for Vercel serverless - as a handler function
module.exports = app;