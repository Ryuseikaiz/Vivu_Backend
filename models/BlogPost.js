const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    minlength: 100
  },
  excerpt: {
    type: String,
    maxlength: 300
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  destination: {
    type: String,
    required: true,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  images: [{
    url: String,
    caption: String,
    alt: String
  }],
  location: {
    coordinates: {
      lat: Number,
      lng: Number
    },
    address: String,
    country: String,
    city: String
  },
  travelDate: {
    startDate: Date,
    endDate: Date
  },
  budget: {
    amount: Number,
    currency: {
      type: String,
      default: 'VND'
    }
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  },
  featured: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create excerpt from content if not provided
blogPostSchema.pre('save', function(next) {
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.substring(0, 297) + '...';
  }
  next();
});

// Index for search
blogPostSchema.index({ title: 'text', content: 'text', destination: 'text' });
blogPostSchema.index({ createdAt: -1 });
blogPostSchema.index({ featured: -1, createdAt: -1 });

module.exports = mongoose.model('BlogPost', blogPostSchema);