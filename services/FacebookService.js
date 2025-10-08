const axios = require('axios');

class FacebookService {
  constructor() {
    this.pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    this.pageId = process.env.FACEBOOK_PAGE_ID;
    this.appSecret = process.env.FACEBOOK_APP_SECRET;
    this.webhookVerifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
    
    console.log('🔵 Facebook Service initialized');
    console.log('Page ID:', this.pageId ? '✅ Configured' : '❌ Missing');
    console.log('Access Token:', this.pageAccessToken ? '✅ Configured' : '❌ Missing');
    console.log('Webhook Token:', this.webhookVerifyToken ? '✅ Configured' : '❌ Missing');
  }

  /**
   * Fetch latest posts from Facebook page
   */
  async getLatestPosts(limit = 5) {
    try {
      if (!this.pageAccessToken) {
        console.log('⚠️ Facebook Page Access Token not configured');
        // Return dummy data for development
        return this.getDummyPosts(limit);
      }

      const fields = [
        'id',
        'message', 
        'story',
        'created_time',
        'updated_time',
        'permalink_url',
        'full_picture',
        'attachments{media,url,title,description}',
        'reactions.summary(total_count)',
        'comments.summary(total_count)',
        'shares'
      ].join(',');

      const url = `https://graph.facebook.com/v18.0/${this.pageId}/posts`;
      const response = await axios.get(url, {
        params: {
          access_token: this.pageAccessToken,
          fields: fields,
          limit: limit
        }
      });

      return response.data.data.map(post => this.formatPost(post));
    } catch (error) {
      console.error('Error fetching Facebook posts:', error.response?.data || error.message);
      
      // Handle expired token gracefully
      if (error.response?.data?.error?.code === 190) {
        console.log('⚠️ Facebook access token expired. Please update FACEBOOK_PAGE_ACCESS_TOKEN in .env');
        console.log('ℹ️ Get new token from: https://developers.facebook.com/tools/explorer/');
        console.log('ℹ️ Grant permissions: pages_show_list, pages_read_engagement');
      }
      
      return [];
    }
  }

  /**
   * Format Facebook post for frontend
   */
  formatPost(post) {
    return {
      id: post.id,
      message: post.message || post.story || '',
      createdTime: post.created_time,
      updatedTime: post.updated_time,
      permalink: post.permalink_url,
      image: post.full_picture || post.attachments?.data?.[0]?.media?.image?.src,
      attachment: post.attachments?.data?.[0] ? {
        title: post.attachments.data[0].title,
        description: post.attachments.data[0].description,
        url: post.attachments.data[0].url
      } : null,
      engagement: {
        reactions: post.reactions?.summary?.total_count || 0,
        comments: post.comments?.summary?.total_count || 0,
        shares: post.shares?.count || 0
      },
      type: 'facebook_post',
      source: 'Facebook'
    };
  }

  /**
   * Verify webhook signature (security)
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.appSecret) return false;
    
    const crypto = require('crypto');
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', this.appSecret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Handle webhook verification
   */
  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      console.log('✅ Facebook webhook verified successfully');
      return challenge;
    }
    return null;
  }

  /**
   * Process webhook data
   */
  async processWebhookData(data) {
    try {
      const entries = data.entry || [];
      const results = [];

      for (const entry of entries) {
        const changes = entry.changes || [];
        
        for (const change of changes) {
          if (change.field === 'feed') {
            const value = change.value;
            
            // Handle new post
            if (value.verb === 'add' && value.item === 'post') {
              console.log('📝 New Facebook post detected:', value.post_id);
              
              // Fetch full post data
              const post = await this.getPostById(value.post_id);
              if (post) {
                results.push({
                  type: 'new_post',
                  post: post
                });
              }
            }
            
            // Handle post update/edit
            if (value.verb === 'edited' && value.item === 'post') {
              console.log('✏️ Facebook post updated:', value.post_id);
              
              const post = await this.getPostById(value.post_id);
              if (post) {
                results.push({
                  type: 'updated_post',
                  post: post
                });
              }
            }
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error processing webhook data:', error);
      return [];
    }
  }

  /**
   * Get specific post by ID
   */
  async getPostById(postId) {
    try {
      const fields = [
        'id', 'message', 'story', 'created_time', 'updated_time',
        'permalink_url', 'full_picture', 'attachments{media,url,title,description}',
        'reactions.summary(total_count)', 'comments.summary(total_count)', 'shares'
      ].join(',');

      const response = await axios.get(`https://graph.facebook.com/v18.0/${postId}`, {
        params: {
          access_token: this.pageAccessToken,
          fields: fields
        }
      });

      return this.formatPost(response.data);
    } catch (error) {
      console.error('Error fetching post by ID:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Verify webhook challenge from Facebook
   */
  verifyWebhook(mode, token, challenge) {
    console.log('🔍 Webhook verification requested');
    console.log('Mode:', mode);
    console.log('Token received:', token);
    console.log('Expected token:', this.webhookVerifyToken);
    
    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      console.log('✅ Webhook verified successfully');
      return challenge;
    } else {
      console.log('❌ Webhook verification failed');
      return null;
    }
  }

  /**
   * Handle incoming webhook data
   */
  handleWebhook(body) {
    try {
      console.log('📨 Webhook received:', JSON.stringify(body, null, 2));
      
      if (body.object === 'page') {
        body.entry.forEach(entry => {
          entry.changes?.forEach(change => {
            if (change.field === 'feed') {
              console.log('📝 New post detected:', change.value);
              // Here you can trigger refresh of posts cache
              // or send notification to frontend via websocket
              this.onNewPost(change.value);
            }
          });
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error handling webhook:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle new post notification
   */
  onNewPost(postData) {
    console.log('🎉 New Facebook post published:', postData);
    // TODO: Implement real-time notification to frontend
    // Could use WebSocket, Server-Sent Events, or database trigger
  }

  /**
   * Test Facebook API connection
   */
  async testConnection() {
    try {
      if (!this.pageAccessToken || !this.pageId) {
        return { success: false, error: 'Missing Facebook configuration' };
      }

      const response = await axios.get(`https://graph.facebook.com/v18.0/${this.pageId}`, {
        params: {
          fields: 'name,fan_count,link',
          access_token: this.pageAccessToken
        },
        timeout: 5000
      });

      return {
        success: true,
        pageInfo: {
          name: response.data.name,
          fanCount: response.data.fan_count,
          link: response.data.link
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Generate dummy posts for development when token is not available
   */
  getDummyPosts(limit = 5) {
    const dummyPosts = [
      {
        id: 'dummy_1',
        message: '🌟 Khám phá vẻ đẹp thiên nhiên Việt Nam cùng Vivu! Hãy để chúng tôi đồng hành cùng bạn trong những chuyến phiêu lưu đáng nhớ.',
        createdTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        permalink: 'https://www.facebook.com/vivuvivuv1',
        image: '/du-lich-1706241807351523195579.jpg',
        attachment: {
          title: 'Cùng Vivu khám phá Việt Nam',
          description: 'Những điểm đến tuyệt vời đang chờ đón bạn',
          url: 'https://www.facebook.com/vivuvivuv1'
        },
        engagement: {
          reactions: 42,
          comments: 8,
          shares: 3
        },
        type: 'facebook_post',
        source: 'Facebook'
      },
      {
        id: 'dummy_2', 
        message: '🏔️ Sapa mùa này đẹp lắm! Ai muốn lên Sapa ngắm mây và thưởng thức không khí trong lành không? Vivu sẽ giúp bạn lên kế hoạch chi tiết nhất.',
        createdTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        permalink: 'https://www.facebook.com/vivuvivuv1',
        image: null,
        attachment: null,
        engagement: {
          reactions: 28,
          comments: 12,
          shares: 5
        },
        type: 'facebook_post',
        source: 'Facebook'
      },
      {
        id: 'dummy_3',
        message: '🌊 Phú Quốc - thiên đường biển đảo! Nước trong xanh, cát trắng mịn và hải sản tươi ngon. Đặt tour ngay hôm nay để nhận ưu đãi đặc biệt!',
        createdTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        permalink: 'https://www.facebook.com/vivuvivuv1',
        image: null,
        attachment: {
          title: 'Tour Phú Quốc 3N2Đ',
          description: 'Khám phá đảo ngọc với giá ưu đãi',
          url: 'https://www.facebook.com/vivuvivuv1'
        },
        engagement: {
          reactions: 67,
          comments: 23,
          shares: 11
        },
        type: 'facebook_post',
        source: 'Facebook'
      }
    ];

    return dummyPosts.slice(0, limit);
  }
}

module.exports = FacebookService;