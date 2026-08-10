const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../../config/db");

const normalizePhone = (phone) => {
  if (typeof phone !== "string") {
    return null;
  }

  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return digits;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  return null;
};

// REGISTER USER
const register = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      organizationId,
      plantId,
    } = req.body;

    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, password and role are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          {
            email: normalizedEmail,
          },
          {
            phone: normalizedPhone,
          },
        ],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or phone already exists",
      });
    }

    const allowedRoles = [
      "ADMIN",
      "CLIENT",
      "OPERATOR",
      "ENGINEER",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
      });
    }

    if (organizationId) {
      const organization = await prisma.organization.findUnique({
        where: {
          id: organizationId,
        },
      });

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: "Organization not found",
        });
      }
    }

    if (plantId) {
      const plant = await prisma.plant.findUnique({
        where: {
          id: plantId,
        },
      });

      if (!plant) {
        return res.status(404).json({
          success: false,
          message: "Plant not found",
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);


    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        role,
        organizationId: organizationId || null,
        plantId: plantId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        organizationId: true,
        plantId: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// LOGIN WITH PHONE NUMBER
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

if (!phone || !password) {
  return res.status(400).json({
    success: false,
    message: "Phone number and password are required",
  });
}

const normalizedPhone = phone.trim();

const user = await prisma.user.findUnique({
  where: {
    phone: normalizedPhone,
  },
});
if (!user) {
  return res.status(401).json({
    success: false,
    message: "Invalid phone number or password",
  });
}

const passwordMatches = await bcrypt.compare(
  password,
  user.passwordHash
);

console.log("Entered password:", password);
console.log("Password matches:", passwordMatches);

if (!passwordMatches) {
  return res.status(401).json({
    success: false,
    message: "Invalid phone number or password",
  });
}


    if (user.status === "INACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error(
        "JWT_SECRET is missing from environment variables"
      );
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );
console.log("LOGIN SUCCESS");
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId,
        plantId: user.plantId,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const normalizedPhone = normalizePhone(req.body.phone);

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit phone number",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        phone: normalizedPhone,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!user || user.status === "INACTIVE") {
      return res.status(200).json({
        success: true,
        message:
          "If an active account exists for this phone number, an OTP has been generated",
      });
    }

    await prisma.passwordResetOtp.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.passwordResetOtp.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt,
      },
    });

    console.log(`Password reset OTP for ${normalizedPhone}: ${otp}`);

    const response = {
      success: true,
      message: "OTP generated successfully",
      expiresInSeconds: 300,
    };

    if (process.env.DEV_OTP_MODE === "true") {
      response.otp = otp;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate OTP",
    });
  }
};

const verifyPasswordResetOtp = async (req, res) => {
  try {
    const normalizedPhone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || "").trim();

    if (!normalizedPhone || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "A valid phone number and 6-digit OTP are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        phone: normalizedPhone,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!user || user.status === "INACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    const otpRecord = await prisma.passwordResetOtp.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    const otpMatches = await bcrypt.compare(
      otp,
      otpRecord.otpHash
    );

    if (!otpMatches) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    await prisma.passwordResetOtp.update({
      where: {
        id: otpRecord.id,
      },
      data: {
        verifiedAt: new Date(),
      },
    });

    if (!process.env.PASSWORD_RESET_SECRET) {
      throw new Error("PASSWORD_RESET_SECRET is missing");
    }

    const resetToken = jwt.sign(
      {
        userId: user.id,
        otpId: otpRecord.id,
        purpose: "PASSWORD_RESET",
      },
      process.env.PASSWORD_RESET_SECRET,
      {
        expiresIn: "10m",
      }
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    if (!process.env.PASSWORD_RESET_SECRET) {
      throw new Error("PASSWORD_RESET_SECRET is missing");
    }

    let decoded;

    try {
      decoded = jwt.verify(
        resetToken,
        process.env.PASSWORD_RESET_SECRET
      );
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    if (
      decoded.purpose !== "PASSWORD_RESET" ||
      !decoded.userId ||
      !decoded.otpId
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid reset token",
      });
    }

    const otpRecord = await prisma.passwordResetOtp.findFirst({
      where: {
        id: decoded.otpId,
        userId: decoded.userId,
        usedAt: null,
        verifiedAt: {
          not: null,
        },
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpRecord) {
      return res.status(401).json({
        success: false,
        message:
          "Reset session is invalid or has already been used",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      user.passwordHash
    );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the old password",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordHash,
        },
      }),

      prisma.passwordResetOtp.update({
        where: {
          id: otpRecord.id,
        },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
};

const updateAdminPassword = async (req, res) => {
  try {
    const { newPassword, confirmNewPassword } = req.body;

    if (!newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation are required",
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Update Admin password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update password",
    });
  }
};

module.exports = {
  getMe,
  updateAdminPassword,
  register,
  login,
  changePassword,
  forgotPassword,
  verifyPasswordResetOtp,
  resetPassword,
};
