const express = require("express");

const protect = require("../middleware/auth.middleware");

const {
  register,
  login,
  changePassword,
  forgotPassword,
  verifyPasswordResetOtp,
  resetPassword,
} = require("../controllers/auth/auth.controller");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

router.patch(
  "/change-password",
  protect,
  changePassword
);

router.post(
  "/forgot-password",
  forgotPassword
);

router.post(
  "/verify-reset-otp",
  verifyPasswordResetOtp
);

router.post(
  "/reset-password",
  resetPassword
);

module.exports = router;