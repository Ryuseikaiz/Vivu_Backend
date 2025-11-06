const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const checkDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-travel-agent', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const normalUsers = await User.countDocuments({ role: { $ne: 'admin' } });

    console.log('\n📊 Current Database Status:');
    console.log('==========================');
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Admin Users: ${adminUsers}`);
    console.log(`Normal Users: ${normalUsers}`);
    console.log('==========================\n');

    if (normalUsers > 0) {
      console.log('✅ You still have user data in the database!');
      
      // Show some sample users
      const sampleUsers = await User.find({ role: { $ne: 'admin' } }).limit(5);
      console.log('\nSample users:');
      sampleUsers.forEach(u => {
        console.log(`- ${u.name} (${u.email}) - Created: ${u.createdAt}`);
      });
    } else {
      console.log('⚠️  No user data found (only admin account exists)');
      console.log('Your old data may have been deleted.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkDatabase();
