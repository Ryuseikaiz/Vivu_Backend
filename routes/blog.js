const express = require('express');
const BlogPost = require('../models/BlogPost');
const { auth } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const createBlogSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  content: Joi.string().min(100).required(),
  destination: Joi.string().min(2).max(100).required(),
  tags: Joi.array().items(Joi.string().max(50)).max(10),
  images: Joi.array().items(Joi.object({
    url: Joi.string().uri(),
    caption: Joi.string().max(200),
    alt: Joi.string().max(100)
  })).max(10),
  location: Joi.object({
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90),
      lng: Joi.number().min(-180).max(180)
    }),
    address: Joi.string().max(200),
    country: Joi.string().max(100),
    city: Joi.string().max(100)
  }),
  travelDate: Joi.object({
    startDate: Joi.date(),
    endDate: Joi.date().min(Joi.ref('startDate'))
  }),
  budget: Joi.object({
    amount: Joi.number().min(0),
    currency: Joi.string().valid('VND', 'USD', 'EUR')
  }),
  rating: Joi.number().min(1).max(5)
});

// Get all published blog posts (public)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, destination, tag, featured } = req.query;
    const skip = (page - 1) * limit;

    let query = { status: 'published' };
    
    if (destination) {
      query.destination = new RegExp(destination, 'i');
    }
    
    if (tag) {
      query.tags = { $in: [new RegExp(tag, 'i')] };
    }
    
    if (featured === 'true') {
      query.featured = true;
    }

    const posts = await BlogPost.find(query)
      .populate('author', 'name email')
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await BlogPost.countDocuments(query);

    res.json({
      posts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get single blog post (public)
router.get('/:id', async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id)
      .populate('author', 'name email')
      .populate('comments.user', 'name');

    if (!post || post.status !== 'published') {
      return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    }

    // Increment view count
    post.viewCount += 1;
    await post.save();

    res.json({ post });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Create new blog post (authenticated)
router.post('/', auth, async (req, res) => {
  try {
    const { error } = createBlogSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const blogPost = new BlogPost({
      ...req.body,
      author: req.user._id
    });

    await blogPost.save();
    await blogPost.populate('author', 'name email');

    res.status(201).json({
      message: 'Tạo blog thành công',
      post: blogPost
    });
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Update blog post (authenticated, author only)
router.put('/:id', auth, async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Không có quyền chỉnh sửa' });
    }

    const { error } = createBlogSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    Object.assign(post, req.body);
    await post.save();
    await post.populate('author', 'name email');

    res.json({
      message: 'Cập nhật blog thành công',
      post
    });
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Delete blog post (authenticated, author only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Không có quyền xóa' });
    }

    await BlogPost.findByIdAndDelete(req.params.id);

    res.json({ message: 'Xóa blog thành công' });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Like/Unlike blog post (authenticated)
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    }

    const existingLike = post.likes.find(like => 
      like.user.toString() === req.user._id.toString()
    );

    if (existingLike) {
      // Unlike
      post.likes = post.likes.filter(like => 
        like.user.toString() !== req.user._id.toString()
      );
    } else {
      // Like
      post.likes.push({ user: req.user._id });
    }

    await post.save();

    res.json({
      message: existingLike ? 'Đã bỏ thích' : 'Đã thích',
      likesCount: post.likes.length,
      isLiked: !existingLike
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Add comment (authenticated)
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim().length < 5) {
      return res.status(400).json({ error: 'Bình luận phải có ít nhất 5 ký tự' });
    }

    const post = await BlogPost.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    }

    post.comments.push({
      user: req.user._id,
      content: content.trim()
    });

    await post.save();
    await post.populate('comments.user', 'name');

    const newComment = post.comments[post.comments.length - 1];

    res.status(201).json({
      message: 'Thêm bình luận thành công',
      comment: newComment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get user's blog posts (authenticated)
router.get('/user/my-posts', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const posts = await BlogPost.find({ author: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await BlogPost.countDocuments({ author: req.user._id });

    res.json({
      posts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;