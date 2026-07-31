const bcrypt = require("bcryptjs");
const prisma = require("../../config/db");

const allowedStatuses = [
  "ACTIVE",
  "INACTIVE",
  "STANDBY",
  "AVAILABLE",
];

// CREATE ENGINEER
const createEngineer = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      status,
      organizationId,
      plantId,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid engineer status",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone?.trim() || null;

    const duplicateUser = await prisma.user.findFirst({
      where: {
        OR: [
          {
            email: normalizedEmail,
          },
          ...(normalizedPhone
            ? [
                {
                  phone: normalizedPhone,
                },
              ]
            : []),
        ],
      },
    });

    if (duplicateUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or phone already exists",
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
        include: {
          building: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!plant) {
        return res.status(404).json({
          success: false,
          message: "Plant not found",
        });
      }

      if (
        organizationId &&
        plant.building.organizationId !== organizationId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Selected plant does not belong to the selected organization",
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const engineer = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        role: "ENGINEER",
        status: status || "AVAILABLE",
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
        updatedAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Engineer created successfully",
      engineer,
    });
  } catch (error) {
    console.error("Create engineer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create engineer",
    });
  }
};

// GET ALL ENGINEERS
const getEngineers = async (req, res) => {
  try {
    const {
      search = "",
      status,
      organizationId,
      plantId,
      page = "1",
      limit = "20",
    } = req.query;

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid engineer status",
      });
    }

    const pageNumber = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 20, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      role: "ENGINEER",
      ...(status && {
        status,
      }),
      ...(organizationId && {
        organizationId,
      }),
      ...(plantId && {
        plantId,
      }),
      ...(search && {
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            phone: {
              contains: search,
            },
          },
        ],
      }),
    };

    const [engineers, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: limitNumber,
        orderBy: {
          createdAt: "desc",
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
          updatedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          plant: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              assignedTickets: true,
            },
          },
        },
      }),

      prisma.user.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      engineers,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get engineers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch engineers",
    });
  }
};

// GET AVAILABLE ENGINEERS
const getAvailableEngineers = async (req, res) => {
  try {
    const engineers = await prisma.user.findMany({
      where: {
        role: "ENGINEER",
        status: {
          in: ["AVAILABLE", "ACTIVE"],
        },
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        organizationId: true,
        plantId: true,
        plant: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            assignedTickets: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      engineers,
    });
  } catch (error) {
    console.error("Get available engineers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch available engineers",
    });
  }
};

// GET ENGINEER BY ID
const getEngineerById = async (req, res) => {
  try {
    const { id } = req.params;

    const engineer = await prisma.user.findFirst({
      where: {
        id,
        role: "ENGINEER",
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
        updatedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        plant: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        assignedTickets: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            plantId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      });
    }

    return res.status(200).json({
      success: true,
      engineer,
    });
  } catch (error) {
    console.error("Get engineer by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch engineer",
    });
  }
};

// UPDATE ENGINEER
const updateEngineer = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      email,
      phone,
      password,
      status,
      organizationId,
      plantId,
    } = req.body;

    const existingEngineer = await prisma.user.findFirst({
      where: {
        id,
        role: "ENGINEER",
      },
    });

    if (!existingEngineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      });
    }

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid engineer status",
      });
    }

    const normalizedEmail =
      email !== undefined
        ? email.trim().toLowerCase()
        : existingEngineer.email;

    const normalizedPhone =
      phone !== undefined
        ? phone?.trim() || null
        : existingEngineer.phone;

    if (email !== undefined || phone !== undefined) {
      const duplicateUser = await prisma.user.findFirst({
        where: {
          id: {
            not: id,
          },
          OR: [
            {
              email: normalizedEmail,
            },
            ...(normalizedPhone
              ? [
                  {
                    phone: normalizedPhone,
                  },
                ]
              : []),
          ],
        },
      });

      if (duplicateUser) {
        return res.status(409).json({
          success: false,
          message: "Another user already uses this email or phone",
        });
      }
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
        include: {
          building: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!plant) {
        return res.status(404).json({
          success: false,
          message: "Plant not found",
        });
      }

      const finalOrganizationId =
        organizationId !== undefined
          ? organizationId
          : existingEngineer.organizationId;

      if (
        finalOrganizationId &&
        plant.building.organizationId !== finalOrganizationId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Selected plant does not belong to the selected organization",
        });
      }
    }

    let passwordHash;

    if (password !== undefined) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least 6 characters",
        });
      }

      passwordHash = await bcrypt.hash(password, 12);
    }

    const engineer = await prisma.user.update({
      where: {
        id,
      },
      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),
        ...(email !== undefined && {
          email: normalizedEmail,
        }),
        ...(phone !== undefined && {
          phone: normalizedPhone,
        }),
        ...(password !== undefined && {
          passwordHash,
        }),
        ...(status !== undefined && {
          status,
        }),
        ...(organizationId !== undefined && {
          organizationId: organizationId || null,
        }),
        ...(plantId !== undefined && {
          plantId: plantId || null,
        }),
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
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Engineer updated successfully",
      engineer,
    });
  } catch (error) {
    console.error("Update engineer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update engineer",
    });
  }
};

// DELETE ENGINEER
const deleteEngineer = async (req, res) => {
  try {
    const { id } = req.params;

    const engineer = await prisma.user.findFirst({
      where: {
        id,
        role: "ENGINEER",
      },
      include: {
        _count: {
          select: {
            assignedTickets: true,
          },
        },
      },
    });

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      });
    }

    if (engineer._count.assignedTickets > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete engineer because tickets are assigned to this engineer",
      });
    }

    await prisma.user.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Engineer deleted successfully",
    });
  } catch (error) {
    console.error("Delete engineer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete engineer",
    });
  }
};

module.exports = {
  createEngineer,
  getEngineers,
  getAvailableEngineers,
  getEngineerById,
  updateEngineer,
  deleteEngineer,
};