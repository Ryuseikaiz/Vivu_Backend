require('dotenv').config();
const mongoose = require('mongoose');
const PromoCode = require('./models/PromoCode');
const User = require('./models/User');

async function createPromoCode() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find or create a system admin user
    let adminUser = await User.findOne({ email: 'admin@vivu.com' });
    
    if (!adminUser) {
      console.log('Creating system admin user...');
      adminUser = new User({
        email: 'admin@vivu.com',
        name: 'System Admin',
        role: 'admin',
        googleId: 'system-admin' // bypass password requirement
      });
      await adminUser.save();
      console.log('✅ System admin user created');
    } else {
      console.log('Found existing admin user');
    }

    // Check if promo code already exists
    const existingPromo = await PromoCode.findOne({ code: 'VIVU1MON' });
    if (existingPromo) {
      console.log('⚠️  Promo code VIVU1MON already exists!');
      console.log('Code:', existingPromo.code);
      console.log('Type:', existingPromo.type);
      console.log('Duration:', existingPromo.duration, 'months');
      console.log('Max Uses:', existingPromo.maxUses || 'Unlimited');
      console.log('Used Count:', existingPromo.usedCount);
      console.log('Active:', existingPromo.isActive);
      await mongoose.connection.close();
      return;
    }

    // Create 1-month promo code
    const promoCode = new PromoCode({
      code: 'VIVU1MON',
      type: 'monthly',
      duration: 1, // 1 month
      maxUses: null, // unlimited uses
      expiresAt: null, // never expires (but gives 1 month subscription)
      usedBy: [],
      isActive: true,
      createdBy: adminUser._id
    });

    await promoCode.save();
    console.log('✅ Promo code created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Code:', promoCode.code);
    console.log('🎁 Type:', promoCode.type);
    console.log('⏱️  Duration:', promoCode.duration, 'month(s)');
    console.log('👥 Max Uses:', promoCode.maxUses || '♾️  Unlimited');
    console.log('📅 Code Expires:', promoCode.expiresAt || 'Never');
    console.log('✨ Status:', promoCode.isActive ? 'Active' : 'Inactive');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('ℹ️  This code gives users a 1-month subscription');
    
    await mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('❌ Error creating promo code:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

createPromoCode();
