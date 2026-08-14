// PURPOSE:
// This file implements operator CRUD controller operations for engineer-assigned plants.
// It validates status and phone data, hashes passwords, and manages operator users through Prisma.
const bcrypt = require("bcryptjs");
const prisma = require("../../config/db");

const allowedStatuses = [
  "ACTIVE",
  "INACTIVE",
  "STANDBY",
  "AVAILABLE",
];

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

const getEngineerPlant = async (engineerId) => {
  return prisma.user.findFirst({
    where: {
      id: engineerId,
      role: "ENGINEER",
    },
    select: {
      id: true,
      plantId: true,
      plant: {
        select: {
          id: true,
          building: {
            select: {
              organizationId: true,
            },
          },
        },
      },
    },
  });
};

const operatorSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  organizationId: true,
  plantId: true,
  createdAt: true,
  updatedAt: true,
  plant: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  _count: {
    select: {
      operatorTasks: true,
    },
  },
};

const createOperator = async (req, res) => {
  try {
    const { name, email, phone, password, status } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, phone number and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters",
      });
    }

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operator status",
      });
    }

    const engineer = await getEngineerPlant(req.user.id);

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      });
    }

    if (!engineer.plantId || !engineer.plant) {
      return res.status(400).json({
        success: false,
        message: "Engineer is not assigned to a plant",
      });
    }

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit phone number",
      });
    }

    const normalizedEmail =
      typeof email === "string" && email.trim()
        ? email.trim().toLowerCase()
        : `operator.${normalizedPhone}@sewage.local`;

    const duplicateUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { email: normalizedEmail },
        ],
      },
      select: {
        id: true,
      },
    });

    if (duplicateUser) {
      return res.status(409).json({
        success: false,
        message: "Phone number or email is already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const operator = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        role: "OPERATOR",
        status: status || "ACTIVE",
        plantId: engineer.plantId,
        organizationId:
          engineer.plant.building.organizationId || null,
      },
      select: operatorSelect,
    });

    return res.status(201).json({
      success: true,
      message: "Operator created successfully",
      operator,
    });
  } catch (error) {
    console.error("Create Operator error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create operator",
    });
  }
};

const getOperators = async (req, res) => {
  try {
    const { search = "", status } = req.query;

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operator status",
      });
    }

    const engineer = await getEngineerPlant(req.user.id);

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      });
    }

    if (!engineer.plantId) {
      return res.status(200).json({
        success: true,
        count: 0,
        operators: [],
      });
    }

    const operators = await prisma.user.findMany({
      where: {
        role: "OPERATOR",
        plantId: engineer.plantId,
        ...(status && { status }),
        ...(search && {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              phone: {
                contains: search,
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }),
      },
      orderBy: {
        name: "asc",
      },
      select: operatorSelect,
    });

    return res.status(200).json({
      success: true,
      count: operators.length,
      operators,
    });
  } catch (error) {
    console.error("Get Operators error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch operators",
    });
  }
};

const getOperatorById = async (req, res) => {
  try {
    const engineer = await getEngineerPlant(req.user.id);

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      });
    }

    if (!engineer.plantId) {
  return res.status(400).json({
    success: false,
    message: "Engineer is not assigned to a plant",
  });
}

    const operator = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        role: "OPERATOR",
        plantId: engineer.plantId,
      },
      select: {
        ...operatorSelect,
        operatorTasks: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!operator) {
      return res.status(404).json({
        success: false,
        message: "Operator not found",
      });
    }

    return res.status(200).json({
      success: true,
      operator,
    });
  } catch (error) {
    console.error("Get Operator error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch operator",
    });
  }
};

const updateOperator = async (req, res) => {
  try {
    const { name, email, phone, password, status } = req.body;

    const engineer = await getEngineerPlant(req.user.id);

  if (!engineer) {
  return res.status(404).json({
    success: false,
    message: "Engineer not found",
  });
}

if (!engineer.plantId) {
  return res.status(400).json({
    success: false,
    message: "Engineer is not assigned to a plant",
  });
}

    const existingOperator = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        role: "OPERATOR",
        plantId: engineer.plantId,
      },
    });

    if (!existingOperator) {
      return res.status(404).json({
        success: false,
        message: "Operator not found",
      });
    }

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid operator status",
      });
    }

    if (password !== undefined && password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters",
      });
    }

    let normalizedPhone = existingOperator.phone;

    if (phone !== undefined) {
      normalizedPhone = normalizePhone(phone);

      if (!normalizedPhone) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid 10-digit phone number",
        });
      }
    }

    const normalizedEmail =
      email !== undefined
        ? email.trim().toLowerCase()
        : existingOperator.email;

    if (phone !== undefined || email !== undefined) {
      const duplicateUser = await prisma.user.findFirst({
        where: {
          id: {
            not: existingOperator.id,
          },
          OR: [
            { phone: normalizedPhone },
            { email: normalizedEmail },
          ],
        },
        select: {
          id: true,
        },
      });

      if (duplicateUser) {
        return res.status(409).json({
          success: false,
          message: "Phone number or email is already registered",
        });
      }
    }

    const passwordHash =
      password !== undefined
        ? await bcrypt.hash(password, 12)
        : undefined;

    const operator = await prisma.user.update({
      where: {
        id: existingOperator.id,
      },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email: normalizedEmail }),
        ...(phone !== undefined && { phone: normalizedPhone }),
        ...(passwordHash && { passwordHash }),
        ...(status !== undefined && { status }),
      },
      select: operatorSelect,
    });

    return res.status(200).json({
      success: true,
      message: "Operator updated successfully",
      operator,
    });
  } catch (error) {
    console.error("Update Operator error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update operator",
    });
  }
};

const deleteOperator = async (req, res) => {
  try {
    const engineer = await getEngineerPlant(req.user.id);

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      });
    }

    if (!engineer.plantId) {
  return res.status(400).json({
    success: false,
    message: "Engineer is not assigned to a plant",
  });
}

    const operator = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        role: "OPERATOR",
        plantId: engineer.plantId,
      },
      include: {
        _count: {
          select: {
            operatorTasks: true,
          },
        },
      },
    });

    if (!operator) {
      return res.status(404).json({
        success: false,
        message: "Operator not found",
      });
    }

    if (operator._count.operatorTasks > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete an operator that has task history. Set the operator to INACTIVE instead.",
      });
    }

    await prisma.user.delete({
      where: {
        id: operator.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Operator deleted successfully",
    });
  } catch (error) {
    console.error("Delete Operator error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete operator",
    });
  }
};

module.exports = {
  createOperator,
  getOperators,
  getOperatorById,
  updateOperator,
  deleteOperator,
};
