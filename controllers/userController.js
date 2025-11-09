const User = require("../models/User");
const bcrypt = require("bcryptjs");

const updateProfile = async (req, res) => {
  const { fullName, email } = req.body;
  console.log("fullName:", fullName);

  console.log("user: ", req.user);

  const userId = req.user._id;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ error: "Email đã được sử dụng" });
      }
    }

    user.name = fullName || user.name;
    user.email = email || user.email;

    await user.save();
    res.json({ message: "Cập nhật thông tin thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
  }
};

const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;

  console.log("currentPassword:", currentPassword);
  console.log("newPassword:", newPassword);

  try {
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res
        .status(401)
        .json({ error: "Mật khẩu hiện tại không chính xác" });
    }

    user.password = newPassword;

    await user.save();
    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
  }
};

const uploadAvatar = async (req, res) => {
  const userId = req.user._id;

  if (!req.file) {
    return res.status(400).json({ error: "Không tìm thấy file ảnh" });
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: "Người dùng không tồn tại" });
    }

    res.json({
      message: "Cập nhật ảnh đại diện thành công",
      avatar: user.avatar,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
  }
};

module.exports = {
  updateProfile,
  updatePassword,
  uploadAvatar,
};
