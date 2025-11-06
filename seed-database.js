const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const PromoCode = require('./models/PromoCode');
const BlogPost = require('./models/BlogPost');

dotenv.config();

// Danh sách tên Việt Nam
const firstNames = [
  'Minh', 'Hương', 'Anh', 'Tuấn', 'Linh', 'Hùng', 'Mai', 'Nam', 'Phương', 'Đức',
  'Lan', 'Hải', 'Thảo', 'Long', 'Trang', 'Quang', 'Hà', 'Duy', 'Thu', 'Khoa',
  'Ngọc', 'Bảo', 'My', 'Sơn', 'Huyền', 'Cường', 'Tâm', 'Khánh', 'Vy', 'Toàn',
  'Chi', 'Hiếu', 'Nhung', 'Trung', 'Giang', 'Hạnh', 'Thành', 'Thư', 'Vũ', 'Diệu'
];

const lastNames = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Cao'
];

const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];

// Hàm loại bỏ dấu tiếng Việt
const removeVietnameseTones = (str) => {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  return str;
};

// Hàm tạo email
const generateEmail = (firstName, lastName) => {
  const cleanFirstName = removeVietnameseTones(firstName.toLowerCase());
  const cleanLastName = removeVietnameseTones(lastName.toLowerCase());
  const name = `${cleanFirstName}${cleanLastName}`;
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const random = Math.floor(Math.random() * 999);
  return `${name}${random}@${domain}`;
};

// Hàm tạo ngày random trong khoảng thời gian
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Hàm random với phân phối thực tế
const getSubscriptionType = () => {
  const rand = Math.random();
  if (rand < 0.25) return 'monthly'; // 25%
  if (rand < 0.30) return 'yearly';  // 5%
  if (rand < 0.32) return 'quarterly'; // 2%
  if (rand < 0.33) return 'lifetime'; // 1%
  return 'trial'; // 67%
};

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-travel-agent', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Kiểm tra số người dùng hiện tại
    const currentUserCount = await User.countDocuments();
    console.log(`Current users in database: ${currentUserCount}`);
    console.log('Adding 80 new users...');

    const users = [];
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const authProviders = ['local', 'google', 'facebook'];

    // Tạo 80 người dùng
    for (let i = 0; i < 80; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${lastName} ${firstName}`;
      const email = generateEmail(firstName, lastName);
      const createdAt = randomDate(sixMonthsAgo, now);
      
      // Chọn provider
      const authProvider = authProviders[Math.floor(Math.random() * authProviders.length)];
      
      // Subscription
      const subscriptionType = getSubscriptionType();
      let subscription = {
        type: subscriptionType,
        startDate: createdAt,
        endDate: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000), // trial 24h
        isActive: false
      };

      // Nếu có subscription trả phí
      if (['monthly', 'yearly', 'quarterly', 'lifetime'].includes(subscriptionType)) {
        const startDate = randomDate(createdAt, now);
        let months = 1;
        
        if (subscriptionType === 'monthly') months = 1;
        else if (subscriptionType === 'quarterly') months = 3;
        else if (subscriptionType === 'yearly') months = 12;
        else if (subscriptionType === 'lifetime') months = 999;
        
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + months);
        
        subscription = {
          type: subscriptionType,
          startDate: startDate,
          endDate: endDate,
          isActive: endDate > now
        };
      }

      // Usage: AI searches (phân phối thực tế)
      const hasUsedAI = Math.random() < 0.6; // 60% đã dùng AI
      let searchCount = 0;
      let lastSearchDate = null;
      let trialUsed = false;

      if (hasUsedAI) {
        // Phân phối Pareto: 20% users tạo 80% searches
        if (Math.random() < 0.2) {
          searchCount = Math.floor(Math.random() * 50) + 20; // Power users: 20-70 searches
        } else {
          searchCount = Math.floor(Math.random() * 15) + 1; // Normal users: 1-15 searches
        }
        lastSearchDate = randomDate(createdAt, now);
        trialUsed = true;
      }

      // Promo codes - will be added via separate update
      // Note: promoCodes field có vẻ có issue với schema, skip for now

      const user = {
        name: fullName,
        email: email,
        password: 'password123', // sẽ được hash
        role: 'user',
        authProvider: authProvider,
        emailVerified: true,
        avatar: authProvider === 'google' ? `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}` : null,
        subscription: subscription,
        usage: {
          trialUsed: trialUsed,
          searchCount: searchCount,
          lastSearchDate: lastSearchDate
        },
        createdAt: createdAt,
        updatedAt: now
      };

      users.push(user);
    }

    // Insert users
    console.log('Creating users...');
    const createdUsers = [];
    for (const userData of users) {
      try {
        const newUser = await User.create(userData);
        createdUsers.push(newUser);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⚠️  Skipped duplicate email: ${userData.email}`);
        } else {
          throw error;
        }
      }
    }
    console.log(`✅ Created ${createdUsers.length} new users`);

    // Thống kê
    const stats = {
      total: createdUsers.length,
      trial: createdUsers.filter(u => u.subscription.type === 'trial').length,
      monthly: createdUsers.filter(u => u.subscription.type === 'monthly').length,
      yearly: createdUsers.filter(u => u.subscription.type === 'yearly').length,
      quarterly: createdUsers.filter(u => u.subscription.type === 'quarterly').length,
      lifetime: createdUsers.filter(u => u.subscription.type === 'lifetime').length,
      active: createdUsers.filter(u => u.subscription.isActive).length,
      usedAI: createdUsers.filter(u => u.usage.searchCount > 0).length,
      totalSearches: createdUsers.reduce((sum, u) => sum + u.usage.searchCount, 0),
      withPromo: createdUsers.filter(u => u.promoCodes && u.promoCodes.length > 0).length,
      google: createdUsers.filter(u => u.authProvider === 'google').length,
      facebook: createdUsers.filter(u => u.authProvider === 'facebook').length,
      local: createdUsers.filter(u => u.authProvider === 'local').length,
    };

    console.log('\n📊 Database Statistics:');
    console.log('========================');
    console.log(`Total Users: ${stats.total}`);
    console.log(`\n📈 Subscriptions:`);
    console.log(`  - Trial: ${stats.trial} (${(stats.trial/stats.total*100).toFixed(1)}%)`);
    console.log(`  - Monthly: ${stats.monthly} (${(stats.monthly/stats.total*100).toFixed(1)}%)`);
    console.log(`  - Yearly: ${stats.yearly} (${(stats.yearly/stats.total*100).toFixed(1)}%)`);
    console.log(`  - Quarterly: ${stats.quarterly} (${(stats.quarterly/stats.total*100).toFixed(1)}%)`);
    console.log(`  - Lifetime: ${stats.lifetime} (${(stats.lifetime/stats.total*100).toFixed(1)}%)`);
    console.log(`  - Active: ${stats.active}`);
    console.log(`\n🤖 AI Usage:`);
    console.log(`  - Used AI: ${stats.usedAI} (${(stats.usedAI/stats.total*100).toFixed(1)}%)`);
    console.log(`  - Total Searches: ${stats.totalSearches}`);
    console.log(`  - Avg per User: ${(stats.totalSearches/stats.usedAI).toFixed(1)}`);
    console.log(`\n🎫 Promo Codes:`);
    console.log(`  - Users with Promo: ${stats.withPromo} (${(stats.withPromo/stats.total*100).toFixed(1)}%)`);
    console.log(`\n🔐 Auth Providers:`);
    console.log(`  - Google: ${stats.google} (${(stats.google/stats.total*100).toFixed(1)}%)`);
    console.log(`  - Facebook: ${stats.facebook} (${(stats.facebook/stats.total*100).toFixed(1)}%)`);
    console.log(`  - Local: ${stats.local} (${(stats.local/stats.total*100).toFixed(1)}%)`);
    console.log('========================\n');

    // Tạo một vài promo codes
    await PromoCode.deleteMany({});
    const promoCodes = [
      {
        code: 'WELCOME2024',
        type: 'monthly',
        duration: 1,
        maxUses: 100,
        usedCount: 12,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
        createdBy: (await User.findOne({ role: 'admin' }))._id
      },
      {
        code: 'SUMMER50',
        type: 'quarterly',
        duration: 3,
        maxUses: 50,
        usedCount: 5,
        expiresAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        isActive: true,
        createdBy: (await User.findOne({ role: 'admin' }))._id
      },
      {
        code: 'LIFETIME2024',
        type: 'lifetime',
        duration: 999,
        maxUses: 10,
        usedCount: 2,
        expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        isActive: true,
        createdBy: (await User.findOne({ role: 'admin' }))._id
      }
    ];
    await PromoCode.insertMany(promoCodes);
    console.log(`✅ Created ${promoCodes.length} promo codes`);

    console.log('\n✅ Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
