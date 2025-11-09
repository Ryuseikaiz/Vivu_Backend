const express = require("express");
const router = express.Router();

const {
  updateProfile,
  updatePassword,
  uploadAvatar,
} = require("../controllers/userController");
const upload = require("../middleware/multerConfig");

router.put("/profile", updateProfile);
router.put("/password", updatePassword);
router.post("/avatar", upload.single("avatar"), uploadAvatar);

module.exports = router;
