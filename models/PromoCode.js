const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['monthly', 'quarterly', 'lifetime'],
    required: true
  },
  duration: {
    type: Number, // số tháng (1, 3, hoặc 999 cho lifetime)
    required: true
  },
  maxUses: {
    type: Number,
    default: 1, // mỗi code dùng được bao nhiêu lần
  },
  usedCount: {
    type: Number,
    default: 0
  },
  usedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }],
  expiresAt: {
    type: Date, // ngày hết hạn của mã code
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Check if code is valid
promoCodeSchema.methods.isValid = function() {
  if (!this.isActive) return false;
  if (this.maxUses !== null && this.usedCount >= this.maxUses) return false;
  if (this.expiresAt && new Date() > this.expiresAt) return false;
  return true;
};

// Check if user already used this code
promoCodeSchema.methods.hasUserUsed = function(userId) {
  return this.usedBy.some(used => used.userId.toString() === userId.toString());
};

module.exports = mongoose.model('PromoCode', promoCodeSchema);
