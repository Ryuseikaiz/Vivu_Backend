const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Internal function to generate tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "7d" }
  );
  const refreshToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d" }
  );
  return { accessToken, refreshToken };
};

/**
 * @desc    Login or Register with Google
 * @route   POST /api/auth/google
 * @access  Public
 */
exports.googleLogin = async (req, res) => {
  const { tokenId, credential } = req.body;
  const token = tokenId || credential;

  console.log("Google login request received");
  console.log("Token present:", !!token);

  try {
    if (!token) {
      return res.status(400).json({ message: "No token provided." });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email_verified, name, email, picture } = payload;

    console.log("Token verified for email:", email);

    if (!email_verified) {
      return res.status(400).json({ message: "Google email is not verified." });
    }

    let user = await User.findOne({ email });

    if (user) {
      console.log("Existing user found:", user.email);
      if (user.status === "banned") {
        return res.status(403).json({
          message:
            "Your account has been banned. Please contact an administrator.",
          errorCode: "ACCOUNT_BANNED",
        });
      }
    } else {
      console.log("Creating new user for:", email);
      const nameParts = name.split(" ");
      user = new User({
        name: name,
        email: email,
        password: "hehehe123",
        googleId: payload.sub,
        avatar: picture,
        verified: true,
      });
      await user.save();
      console.log("New user created:", user.email);
    }

    const { accessToken, refreshToken } = generateTokens(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userObject = user.toObject();
    delete userObject.password;

    console.log("Google login successful for:", email);
    res.status(200).json({
      success: true,
      accessToken,
      user: userObject,
    });
  } catch (error) {
    console.error("Google authentication error:", error);
    res.status(500).json({
      message: "Google authentication error.",
      error: error.message,
    });
  }
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const { accessToken, refreshToken } = generateTokens(newUser);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userObject = newUser.toObject();
    delete userObject.password;

    res.status(201).json({
      success: true,
      message: "Registration successful.",
      token: accessToken,
      accessToken,
      user: userObject,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc    Login user with email and password
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password." });
    }

    if (user.status === "banned") {
      return res.status(403).json({
        message:
          "Your account has been banned. Please contact an administrator.",
        errorCode: "ACCOUNT_BANNED",
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userObject = user.toObject();
    delete userObject.password;

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token: accessToken,
      accessToken,
      user: userObject,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = (req, res) => {
  res.cookie("refreshToken", "", { httpOnly: true, expires: new Date(0) });
  res.status(200).json({ message: "Logged out successfully." });
};
