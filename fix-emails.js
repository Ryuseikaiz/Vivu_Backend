const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

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

const fixEmails = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-travel-agent', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Tìm tất cả users có email chứa dấu
    const users = await User.find();
    let fixedCount = 0;
    let skippedCount = 0;

    console.log(`Found ${users.length} users. Checking emails...\n`);

    for (const user of users) {
      const oldEmail = user.email;
      const newEmail = removeVietnameseTones(oldEmail);

      if (oldEmail !== newEmail) {
        console.log(`Fixing: ${oldEmail} -> ${newEmail}`);
        
        // Kiểm tra xem email mới đã tồn tại chưa
        const existingUser = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
        
        if (existingUser) {
          console.log(`⚠️  Email ${newEmail} already exists, adding number...`);
          const random = Math.floor(Math.random() * 9999);
          const [localPart, domain] = newEmail.split('@');
          const finalEmail = `${localPart}${random}@${domain}`;
          user.email = finalEmail;
          console.log(`   -> ${finalEmail}`);
        } else {
          user.email = newEmail;
        }
        
        await user.save();
        fixedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log('\n================================');
    console.log(`✅ Fixed ${fixedCount} emails`);
    console.log(`ℹ️  Skipped ${skippedCount} emails (already valid)`);
    console.log('================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

fixEmails();
