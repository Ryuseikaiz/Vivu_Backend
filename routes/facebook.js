const express = require('express');
const router = express.Router();
const FacebookService = require('../services/FacebookService');

const facebookService = new FacebookService();

/**
 * @desc    Get latest Facebook posts
 * @route   GET /api/facebook/posts
 * @access  Public
 */
router.get('/posts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const posts = await facebookService.getLatestPosts(limit);
    
    res.json({
      success: true,
      count: posts.length,
      posts: posts
    });
  } catch (error) {
    console.error('Error fetching Facebook posts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Facebook posts'
    });
  }
});

/**
 * @desc    Facebook webhook verification
 * @route   GET /api/facebook/webhook
 * @access  Public (Facebook verification)
 */
router.get('/webhook', (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('🔍 Facebook webhook verification attempt');
    console.log('Mode:', mode);
    console.log('Token:', token);

    const result = facebookService.verifyWebhook(mode, token, challenge);
    
    if (result) {
      res.status(200).send(challenge);
    } else {
      console.log('❌ Webhook verification failed');
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.status(500).send('Error');
  }
});

/**
 * @desc    Facebook webhook receiver
 * @route   POST /api/facebook/webhook
 * @access  Public (Facebook webhook)
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.get('X-Hub-Signature-256');
    const payload = JSON.stringify(req.body);
    
    // Verify webhook signature for security
    if (!facebookService.verifyWebhookSignature(payload, signature)) {
      console.log('❌ Invalid webhook signature');
      return res.status(403).send('Forbidden');
    }

    console.log('📨 Facebook webhook received:', JSON.stringify(req.body, null, 2));

    // Process webhook data
    const results = await facebookService.processWebhookData(req.body);
    
    // Here you could:
    // 1. Save new posts to database
    // 2. Notify frontend via WebSocket
    // 3. Update cache
    // 4. Send notifications
    
    for (const result of results) {
      if (result.type === 'new_post') {
        console.log('🆕 Processing new Facebook post:', result.post.id);
        // TODO: Save to database or update cache
      }
      
      if (result.type === 'updated_post') {
        console.log('📝 Processing updated Facebook post:', result.post.id);
        // TODO: Update database record
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Error');
  }
});

/**
 * @desc    Test Facebook API connection
 * @route   GET /api/facebook/test
 * @access  Public
 */
router.get('/test', async (req, res) => {
  try {
    const posts = await facebookService.getLatestPosts(1);
    
    res.json({
      success: true,
      message: 'Facebook API connection working',
      hasToken: !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
      hasPageId: !!process.env.FACEBOOK_PAGE_ID,
      postsFound: posts.length,
      samplePost: posts[0] || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      hasToken: !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
      hasPageId: !!process.env.FACEBOOK_PAGE_ID
    });
  }
});

/**
 * @desc    Webhook verification endpoint
 * @route   GET /api/facebook/webhook
 * @access  Public
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  console.log('🔍 Facebook webhook verification request');
  console.log('Mode:', mode);
  console.log('Token:', token);
  console.log('Expected token:', process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN);
  
  const verificationResult = facebookService.verifyWebhook(mode, token, challenge);
  
  if (verificationResult) {
    console.log('✅ Webhook verified, sending challenge back');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

/**
 * @desc    Handle webhook events
 * @route   POST /api/facebook/webhook
 * @access  Public
 */
router.post('/webhook', (req, res) => {
  console.log('📨 Facebook webhook event received');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const result = facebookService.handleWebhook(req.body);
    
    if (result.success) {
      console.log('✅ Webhook processed successfully');
      res.status(200).send('EVENT_RECEIVED');
    } else {
      console.log('❌ Webhook processing failed:', result.error);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error handling webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;