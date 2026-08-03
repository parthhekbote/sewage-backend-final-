const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("../../config/db");

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

module.exports = {
  register,
  login,
  changePassword,
};