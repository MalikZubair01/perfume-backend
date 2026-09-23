import crypto from "crypto";
import Admin from "../models/Admin.js";
import generateToken from "../utils/generateToken.js";
import asyncHandler from "../utils/asyncHandler.js";

// @route   POST /api/auth/signup
// @access  Public (you may later lock this down to superadmin-only invite)
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email and password are required");
  }

  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    res.status(400);
    throw new Error("An admin with this email already exists");
  }

  const admin = await Admin.create({ name, email, password });

  res.status(201).json({
    success: true,
    token: generateToken(admin._id, admin.role),
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
  });
});

// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  // password has `select: false` in the schema, so explicitly include it here
  const admin = await Admin.findOne({ email: email.toLowerCase() }).select("+password");
  if (!admin) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  res.status(200).json({
    success: true,
    token: generateToken(admin._id, admin.role),
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
  });
});

// @route   POST /api/auth/forgot-password
// @access  Public
// NOTE: this generates a reset token. Actually emailing it requires an email
// service (e.g. Nodemailer + SMTP, or Resend/SendGrid) — plug that in where marked below.
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) {
    // Respond the same way whether or not the email exists — avoids leaking
    // which emails are registered.
    return res.status(200).json({
      success: true,
      message: "If that email is registered, a reset link has been sent",
    });
  }

  const resetToken = admin.getResetPasswordToken();
  await admin.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/admin/reset-password/${resetToken}`;

  // TODO: send `resetUrl` via email service instead of returning it directly.
  console.log("Password reset URL (send this via email in production):", resetUrl);

  res.status(200).json({
    success: true,
    message: "If that email is registered, a reset link has been sent",
    ...(process.env.NODE_ENV !== "production" && { resetUrl }), // dev-only convenience
  });
});

// @route   PUT /api/auth/reset-password/:token
// @access  Public
export const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) {
    res.status(400);
    throw new Error("New password is required");
  }

  const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

  const admin = await Admin.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  }).select("+resetPasswordToken +resetPasswordExpire");

  if (!admin) {
    res.status(400);
    throw new Error("Reset link is invalid or has expired");
  }

  admin.password = password;
  admin.resetPasswordToken = undefined;
  admin.resetPasswordExpire = undefined;
  await admin.save();

  res.status(200).json({
    success: true,
    message: "Password reset successful, please log in",
  });
});

// @route   GET /api/auth/me
// @access  Private (needs verifyToken)
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, admin: req.admin });
});
