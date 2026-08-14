// PURPOSE:
// This file implements tank CRUD controller operations.
// It manages tank records and their related plant data through Prisma.
const prisma = require("../../config/db");

// CREATE TANK
const createTank = async (req, res) => {
  try {
    const {
      name,
      capacity,
      status,
      plantId,
    } = req.body;

    if (!name || capacity === undefined || !plantId) {
      return res.status(400).json({
        success: false,
        message: "Name, capacity and plantId are required",
      });
    }

    const parsedCapacity = Number(capacity);

    if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be a positive number",
      });
    }

    const allowedStatuses = [
      "ACTIVE",
      "INACTIVE",
      "MAINTENANCE",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tank status",
      });
    }

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

    const duplicateTank = await prisma.tank.findFirst({
      where: {
        plantId,
        name: name.trim(),
      },
    });

    if (duplicateTank) {
      return res.status(409).json({
        success: false,
        message: "A tank with this name already exists in the plant",
      });
    }

    const tank = await prisma.tank.create({
      data: {
        name: name.trim(),
        capacity: parsedCapacity,
        status: status || "ACTIVE",
        plantId,
      },
      include: {
        plant: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Tank created successfully",
      tank,
    });
  } catch (error) {
    console.error("Create tank error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create tank",
    });
  }
};

// GET ALL TANKS
const getTanks = async (req, res) => {
  try {
    const {
      search = "",
      plantId,
      status,
      page = "1",
      limit = "10",
    } = req.query;

    const pageNumber = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      ...(plantId && {
        plantId,
      }),
      ...(status && {
        status,
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
            plant: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        ],
      }),
    };

    const [tanks, total] = await prisma.$transaction([
      prisma.tank.findMany({
        where,
        skip,
        take: limitNumber,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          plant: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              sensors: true,
            },
          },
        },
      }),

      prisma.tank.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      tanks,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get tanks error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tanks",
    });
  }
};

// GET TANK BY ID
const getTankById = async (req, res) => {
  try {
    const { id } = req.params;

    const tank = await prisma.tank.findUnique({
      where: {
        id,
      },
      include: {
        plant: {
          include: {
            building: {
              include: {
                organization: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        sensors: {
          include: {
            _count: {
              select: {
                readings: true,
                alerts: true,
              },
            },
          },
        },
      },
    });

    if (!tank) {
      return res.status(404).json({
        success: false,
        message: "Tank not found",
      });
    }

    return res.status(200).json({
      success: true,
      tank,
    });
  } catch (error) {
    console.error("Get tank by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tank",
    });
  }
};

// UPDATE TANK
const updateTank = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      capacity,
      status,
      plantId,
    } = req.body;

    const existingTank = await prisma.tank.findUnique({
      where: {
        id,
      },
    });

    if (!existingTank) {
      return res.status(404).json({
        success: false,
        message: "Tank not found",
      });
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

    let parsedCapacity;

    if (capacity !== undefined) {
      parsedCapacity = Number(capacity);

      if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Capacity must be a positive number",
        });
      }
    }

    const allowedStatuses = [
      "ACTIVE",
      "INACTIVE",
      "MAINTENANCE",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tank status",
      });
    }

    const finalPlantId = plantId || existingTank.plantId;
    const finalName = name?.trim() || existingTank.name;

    if (name !== undefined || plantId !== undefined) {
      const duplicateTank = await prisma.tank.findFirst({
        where: {
          id: {
            not: id,
          },
          plantId: finalPlantId,
          name: finalName,
        },
      });

      if (duplicateTank) {
        return res.status(409).json({
          success: false,
          message: "A tank with this name already exists in the plant",
        });
      }
    }

    const tank = await prisma.tank.update({
      where: {
        id,
      },
      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),
        ...(capacity !== undefined && {
          capacity: parsedCapacity,
        }),
        ...(status !== undefined && {
          status,
        }),
        ...(plantId !== undefined && {
          plantId,
        }),
      },
      include: {
        plant: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Tank updated successfully",
      tank,
    });
  } catch (error) {
    console.error("Update tank error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update tank",
    });
  }
};

// DELETE TANK
const deleteTank = async (req, res) => {
  try {
    const { id } = req.params;

    const tank = await prisma.tank.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            sensors: true,
          },
        },
      },
    });

    if (!tank) {
      return res.status(404).json({
        success: false,
        message: "Tank not found",
      });
    }

    if (tank._count.sensors > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete tank because it has linked sensors",
      });
    }

    await prisma.tank.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Tank deleted successfully",
    });
  } catch (error) {
    console.error("Delete tank error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete tank",
    });
  }
};

module.exports = {
  createTank,
  getTanks,
  getTankById,
  updateTank,
  deleteTank,
};
