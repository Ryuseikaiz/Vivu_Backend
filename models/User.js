const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function() {
        // Password is required only if not using OAuth
        return !this.googleId && !this.facebookId;
      },
      minlength: 6,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // OAuth fields
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    facebookId: {
      type: String,
      sparse: true,
      unique: true,
    },
    avatar: {
      type: String,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'facebook'],
      default: 'local',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    subscription: {
      type: {
        type: String,
        enum: ["trial", "monthly", "yearly", "lifetime", "quarterly", "expired"],
        default: "trial",
      },
      startDate: {
        type: Date,
        default: Date.now,
      },
      endDate: {
        type: Date,
        default: function () {
          // Trial expires after 24 hours
          return new Date(Date.now() + 24 * 60 * 60 * 1000);
        },
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },
    usage: {
      trialUsed: {
        type: Boolean,
        default: false,
      },
      searchCount: {
        type: Number,
        default: 0,
      },
      lastSearchDate: {
        type: Date,
      },
    },
    promoCodes: [{
      code: String,
      usedAt: {
        type: Date,
        default: Date.now
      },
      type: String
    }],
    paymentHistory: [
      {
        orderId: String,
        amount: Number,
        currency: String,
        subscriptionType: String,
        paymentDate: Date,
        status: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Skip hashing if password is not modified or is null/undefined (for OAuth users)
  if (!this.isModified("password") || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if user can use trial
userSchema.methods.canUseTrial = function () {
  return this.subscription.type === "trial" && !this.usage.trialUsed;
};

// Virtual property for subscription active status
userSchema.virtual('isSubscriptionActive').get(function() {
  if (this.subscription.type === "trial" && !this.usage.trialUsed) {
    return true;
  }

  if (this.subscription.type === "expired") {
    return false;
  }

  return this.subscription.isActive && new Date() < this.subscription.endDate;
});

// Ensure virtuals are included when converting to JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Use trial
userSchema.methods.useTrial = function () {
  this.usage.trialUsed = true;
  this.usage.searchCount += 1;
  this.usage.lastSearchDate = new Date();
};

// Update subscription
userSchema.methods.updateSubscription = function (type, months = 1) {
  this.subscription.type = type;
  this.subscription.startDate = new Date();
  this.subscription.endDate = new Date(
    Date.now() + months * 30 * 24 * 60 * 60 * 1000
  );
  this.subscription.isActive = true;
  
  // Mark the subscription path as modified to ensure Mongoose saves it
  this.markModified('subscription');
};

module.exports = mongoose.model("User", userSchema);
