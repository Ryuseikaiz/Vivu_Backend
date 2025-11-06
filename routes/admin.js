const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');
const User = require('../models/User');
const PromoCode = require('../models/PromoCode');
const BlogPost = require('../models/BlogPost');

// Middleware: Cần đăng nhập và là admin
router.use(auth, admin);

// Lấy tổng quan thống kê
router.get('/stats/overview', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Tổng số người dùng
    const totalUsers = await User.countDocuments();
    
    // Người dùng mới trong 30 ngày
    const newUsers30Days = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Người dùng mới trong 7 ngày
    const newUsers7Days = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Người dùng có subscription
    const subscribedUsers = await User.countDocuments({
      'subscription.isActive': true
    });

    // Tổng số blog posts
    const totalPosts = await BlogPost.countDocuments();

    // Tổng số promo codes
    const totalPromoCodes = await PromoCode.countDocuments();
    const activePromoCodes = await PromoCode.countDocuments({
      isActive: true,
      expiresAt: { $gt: now }
    });

    res.json({
      totalUsers,
      newUsers30Days,
      newUsers7Days,
      subscribedUsers,
      totalPosts,
      totalPromoCodes,
      activePromoCodes,
      subscriptionRate: totalUsers > 0 ? ((subscribedUsers / totalUsers) * 100).toFixed(2) : 0
    });
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy dữ liệu người dùng theo thời gian (30 ngày gần nhất)
router.get('/stats/users-timeline', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const users = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Tạo mảng đầy đủ 30 ngày
    const timeline = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateString = date.toISOString().split('T')[0];
      const userCount = users.find(u => u._id === dateString);
      
      timeline.push({
        date: dateString,
        count: userCount ? userCount.count : 0
      });
    }

    res.json(timeline);
  } catch (error) {
    console.error('Error fetching users timeline:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy thống kê theo provider
router.get('/stats/auth-providers', async (req, res) => {
  try {
    const providers = await User.aggregate([
      {
        $group: {
          _id: '$authProvider',
          count: { $sum: 1 }
        }
      }
    ]);

    const formatted = providers.map(p => ({
      name: p._id || 'local',
      value: p.count
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching auth providers stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy thống kê subscription
router.get('/stats/subscriptions', async (req, res) => {
  try {
    const subscriptions = await User.aggregate([
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 }
        }
      }
    ]);

    const formatted = subscriptions.map(s => ({
      name: s._id || 'free',
      value: s.count
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching subscriptions stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy danh sách người dùng với phân trang
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy thông tin chi tiết một người dùng
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Cập nhật thông tin người dùng
router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, role, subscription } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (subscription) {
      user.subscription = { ...user.subscription, ...subscription };
    }

    await user.save();

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Xóa người dùng
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy hoạt động gần đây
router.get('/stats/recent-activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Người dùng mới nhất
    const recentUsers = await User.find()
      .select('name email createdAt authProvider')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Blog posts mới nhất
    const recentPosts = await BlogPost.find()
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      recentUsers,
      recentPosts
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy thống kê sử dụng AI
router.get('/stats/ai-usage', async (req, res) => {
  try {
    // Tổng số tìm kiếm AI
    const totalSearches = await User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$usage.searchCount' }
        }
      }
    ]);

    // Người dùng hoạt động nhiều nhất
    const topUsers = await User.find({ 'usage.searchCount': { $gt: 0 } })
      .select('name email usage.searchCount usage.lastSearchDate')
      .sort({ 'usage.searchCount': -1 })
      .limit(10);

    // Thống kê theo ngày (30 ngày gần nhất)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyUsage = await User.aggregate([
      {
        $match: {
          'usage.lastSearchDate': { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$usage.lastSearchDate" }
          },
          searches: { $sum: '$usage.searchCount' },
          users: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Phân bố người dùng theo số lượng tìm kiếm
    const searchDistribution = await User.aggregate([
      {
        $bucket: {
          groupBy: '$usage.searchCount',
          boundaries: [0, 1, 5, 10, 20, 50, 100],
          default: '100+',
          output: {
            count: { $sum: 1 },
            users: { $push: { name: '$name', searchCount: '$usage.searchCount' } }
          }
        }
      }
    ]);

    res.json({
      totalSearches: totalSearches[0]?.total || 0,
      topUsers,
      dailyUsage,
      searchDistribution
    });
  } catch (error) {
    console.error('Error fetching AI usage stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy chi tiết sử dụng AI của từng người dùng
router.get('/stats/user-ai-usage', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'searchCount'; // searchCount, lastSearchDate, name
    const order = req.query.order === 'asc' ? 1 : -1;

    let sortQuery = {};
    if (sortBy === 'searchCount') {
      sortQuery = { 'usage.searchCount': order };
    } else if (sortBy === 'lastSearchDate') {
      sortQuery = { 'usage.lastSearchDate': order };
    } else if (sortBy === 'name') {
      sortQuery = { name: order };
    }

    const users = await User.find()
      .select('name email avatar usage.searchCount usage.lastSearchDate subscription.plan subscription.isActive createdAt')
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    // Thống kê tổng quan
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalSearches: { $sum: '$usage.searchCount' },
          avgSearches: { $avg: '$usage.searchCount' },
          activeUsers: {
            $sum: {
              $cond: [{ $gt: ['$usage.searchCount', 0] }, 1, 0]
            }
          }
        }
      }
    ]);

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total,
      stats: stats[0] || { totalSearches: 0, avgSearches: 0, activeUsers: 0 }
    });
  } catch (error) {
    console.error('Error fetching user AI usage:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy thống kê subscription chi tiết
router.get('/stats/subscription-details', async (req, res) => {
  try {
    const now = new Date();

    // Thống kê theo loại subscription
    const subscriptionStats = await User.aggregate([
      {
        $group: {
          _id: '$subscription.type',
          count: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$subscription.isActive', true] },
                  { $gt: ['$subscription.endDate', now] }
                ]},
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Người dùng có subscription đang hoạt động
    const activeSubscribers = await User.find({
      'subscription.isActive': true,
      'subscription.endDate': { $gt: now }
    })
    .select('name email subscription.type subscription.startDate subscription.endDate')
    .sort({ 'subscription.endDate': 1 })
    .limit(50);

    // Subscription sắp hết hạn (trong 7 ngày tới)
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSubscriptions = await User.find({
      'subscription.isActive': true,
      'subscription.endDate': { $gt: now, $lt: sevenDaysLater }
    })
    .select('name email subscription.type subscription.endDate')
    .sort({ 'subscription.endDate': 1 });

    // Doanh thu theo subscription type
    const revenueByType = await User.aggregate([
      {
        $unwind: '$paymentHistory'
      },
      {
        $group: {
          _id: '$paymentHistory.subscriptionType',
          totalRevenue: { $sum: '$paymentHistory.amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ]);

    // Timeline subscription (30 ngày gần nhất)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const subscriptionTimeline = await User.aggregate([
      {
        $match: {
          'subscription.startDate': { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$subscription.startDate" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      subscriptionStats,
      activeSubscribers,
      expiringSubscriptions,
      revenueByType,
      subscriptionTimeline,
      summary: {
        totalSubscribers: activeSubscribers.length,
        expiringCount: expiringSubscriptions.length
      }
    });
  } catch (error) {
    console.error('Error fetching subscription details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy thống kê promo code
router.get('/stats/promo-code', async (req, res) => {
  try {
    // Thống kê tổng quan promo codes
    const totalPromoCodes = await PromoCode.countDocuments();
    const activePromoCodes = await PromoCode.countDocuments({ 
      isActive: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });
    const usedPromoCodes = await PromoCode.countDocuments({ usedCount: { $gt: 0 } });

    // Top promo codes được sử dụng nhiều nhất
    const topPromoCodes = await PromoCode.find()
      .select('code type duration usedCount maxUses expiresAt isActive')
      .sort({ usedCount: -1 })
      .limit(10);

    // Người dùng đã sử dụng promo code
    const usersWithPromo = await User.find({
      'promoCodes.0': { $exists: true }
    })
    .select('name email promoCodes subscription.type')
    .limit(50);

    // Thống kê theo loại promo code
    const promoByType = await PromoCode.aggregate([
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          used: { $sum: '$usedCount' },
          active: {
            $sum: {
              $cond: ['$isActive', 1, 0]
            }
          }
        }
      }
    ]);

    // Timeline sử dụng promo (30 ngày gần nhất)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const promoUsageTimeline = await PromoCode.aggregate([
      {
        $unwind: '$usedBy'
      },
      {
        $match: {
          'usedBy.usedAt': { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$usedBy.usedAt" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Promo codes sắp hết hạn
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const expiringPromos = await PromoCode.find({
      isActive: true,
      expiresAt: { $gt: new Date(), $lt: sevenDaysLater }
    })
    .select('code type expiresAt usedCount maxUses')
    .sort({ expiresAt: 1 });

    res.json({
      summary: {
        totalPromoCodes,
        activePromoCodes,
        usedPromoCodes,
        usersWithPromoCount: usersWithPromo.length
      },
      topPromoCodes,
      usersWithPromo,
      promoByType,
      promoUsageTimeline,
      expiringPromos
    });
  } catch (error) {
    console.error('Error fetching promo code stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy danh sách người dùng có subscription với filter
router.get('/users/subscribers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const type = req.query.type; // monthly, quarterly, yearly, lifetime
    const status = req.query.status; // active, expired

    const now = new Date();
    let query = {};

    if (type) {
      query['subscription.type'] = type;
    }

    if (status === 'active') {
      query['subscription.isActive'] = true;
      query['subscription.endDate'] = { $gt: now };
    } else if (status === 'expired') {
      query['subscription.endDate'] = { $lt: now };
    }

    const users = await User.find(query)
      .select('name email subscription avatar createdAt')
      .sort({ 'subscription.startDate': -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lấy danh sách người dùng đã sử dụng promo code
router.get('/users/promo-users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find({
      'promoCodes.0': { $exists: true }
    })
    .select('name email promoCodes subscription avatar createdAt')
    .sort({ 'promoCodes.usedAt': -1 })
    .skip(skip)
    .limit(limit);

    const total = await User.countDocuments({
      'promoCodes.0': { $exists: true }
    });

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total
    });
  } catch (error) {
    console.error('Error fetching promo users:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
