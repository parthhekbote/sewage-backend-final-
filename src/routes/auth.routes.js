const express = require("express");

const protect = require("../middleware/auth.middleware");

const {
  register,
  login,
  changePassword,
} = require("../controllers/auth/auth.controller");

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

router.patch(
  "/change-password",
  protect,
  changePassword
);

module.exports = router;