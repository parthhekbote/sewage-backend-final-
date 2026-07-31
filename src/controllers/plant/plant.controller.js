const prisma = require("../../config/db");

// CREATE PLANT
const createPlant = async (req, res) => {
  try {
    const {
      name,
      code,
      address,
      city,
      state,
      pincode,
      capacity,
      technology,
      commissioningDate,
      buildingId,
    } = req.body;

    if (
      !name ||
      !address ||
      !city ||
      !state ||
      !pincode ||
      capacity === undefined ||
      !technology ||
      !buildingId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, address, city, state, pincode, capacity, technology and buildingId are required",
      });
    }

    const parsedCapacity = Number(capacity);

    if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be a positive number",
      });
    }

    const building = await prisma.building.findUnique({
      where: {
        id: buildingId,
      },
    });

    if (!building) {
      return res.status(404).json({
        success: false,
        message: "Building not found",
      });
    }

    const duplicateConditions = [
  {
    buildingId,
    name: name.trim(),
  },
];

if (code?.trim()) {
  duplicateConditions.push({
    code: code.trim(),
  });
}

const duplicatePlant = await prisma.plant.findFirst({
  where: {
    OR: duplicateConditions,
  },
});

    if (duplicatePlant) {
      return res.status(409).json({
        success: false,
        message:
          "A plant with this name in the building or this code already exists",
      });
    }

    let parsedCommissioningDate = null;

    if (commissioningDate) {
      parsedCommissioningDate = new Date(commissioningDate);

      if (Number.isNaN(parsedCommissioningDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid commissioning date",
        });
      }
    }

    const plant = await prisma.plant.create({
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        capacity: parsedCapacity,
        technology: technology.trim(),
        commissioningDate: parsedCommissioningDate,
        buildingId,
      },
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
    });

    return res.status(201).json({
      success: true,
      message: "Plant created successfully",
      plant,
    });
  } catch (error) {
    console.error("Create plant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create plant",
    });
  }
};

// GET ALL PLANTS
const getPlants = async (req, res) => {
  try {
    const {
      search = "",
      buildingId,
      organizationId,
      technology,
      city,
      page = "1",
      limit = "10",
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      ...(buildingId && {
        buildingId,
      }),
      ...(organizationId && {
        building: {
          organizationId,
        },
      }),
      ...(technology && {
        technology: {
          equals: technology,
          mode: "insensitive",
        },
      }),
      ...(city && {
        city: {
          equals: city,
          mode: "insensitive",
        },
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
            code: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            address: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            city: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            building: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
          {
            building: {
              organization: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      }),
    };

    const [plants, total] = await prisma.$transaction([
      prisma.plant.findMany({
        where,
        skip,
        take: limitNumber,
        orderBy: {
          createdAt: "desc",
        },
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
          _count: {
            select: {
              tanks: true,
              alerts: true,
              tickets: true,
              users: true,
            },
          },
        },
      }),

      prisma.plant.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      plants,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get plants error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plants",
    });
  }
};

// GET PLANT BY ID
const getPlantById = async (req, res) => {
  try {
    const { id } = req.params;

    const plant = await prisma.plant.findUnique({
      where: {
        id,
      },
      include: {
        building: {
          include: {
            organization: true,
          },
        },
        tanks: {
          include: {
            sensors: true,
          },
        },
        alerts: {
          orderBy: {
            createdAt: "desc",
          },
        },
        tickets: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            assignedEngineer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
              },
            },
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
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

    return res.status(200).json({
      success: true,
      plant,
    });
  } catch (error) {
    console.error("Get plant by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plant",
    });
  }
};

// UPDATE PLANT
const updatePlant = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      code,
      address,
      city,
      state,
      pincode,
      capacity,
      technology,
      commissioningDate,
      buildingId,
    } = req.body;

    const existingPlant = await prisma.plant.findUnique({
      where: {
        id,
      },
    });

    if (!existingPlant) {
      return res.status(404).json({
        success: false,
        message: "Plant not found",
      });
    }

    if (buildingId) {
      const building = await prisma.building.findUnique({
        where: {
          id: buildingId,
        },
      });

      if (!building) {
        return res.status(404).json({
          success: false,
          message: "Building not found",
        });
      }
    }

    const finalBuildingId =
      buildingId || existingPlant.buildingId;

    if (name || code !== undefined) {
      const duplicateConditions = [];

      if (name) {
        duplicateConditions.push({
  buildingId: finalBuildingId,
  name: name.trim(),
});
      }

      if (code?.trim()) {
        duplicateConditions.push({
          code: code.trim(),
        });
      }

      if (duplicateConditions.length > 0) {
        const duplicatePlant = await prisma.plant.findFirst({
          where: {
            id: {
              not: id,
            },
            OR: duplicateConditions,
          },
        });

        if (duplicatePlant) {
          return res.status(409).json({
            success: false,
            message:
              "Another plant already uses this name in the building or this code",
          });
        }
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

    let parsedCommissioningDate;

    if (commissioningDate !== undefined) {
      if (!commissioningDate) {
        parsedCommissioningDate = null;
      } else {
        parsedCommissioningDate = new Date(commissioningDate);

        if (Number.isNaN(parsedCommissioningDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid commissioning date",
          });
        }
      }
    }

    const plant = await prisma.plant.update({
      where: {
        id,
      },
      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),
        ...(code !== undefined && {
          code: code?.trim() || null,
        }),
        ...(address !== undefined && {
          address: address.trim(),
        }),
        ...(city !== undefined && {
          city: city.trim(),
        }),
        ...(state !== undefined && {
          state: state.trim(),
        }),
        ...(pincode !== undefined && {
          pincode: pincode.trim(),
        }),
        ...(capacity !== undefined && {
          capacity: parsedCapacity,
        }),
        ...(technology !== undefined && {
          technology: technology.trim(),
        }),
        ...(commissioningDate !== undefined && {
          commissioningDate: parsedCommissioningDate,
        }),
        ...(buildingId !== undefined && {
          buildingId,
        }),
      },
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
    });

    return res.status(200).json({
      success: true,
      message: "Plant updated successfully",
      plant,
    });
  } catch (error) {
    console.error("Update plant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update plant",
    });
  }
};

// DELETE PLANT
const deletePlant = async (req, res) => {
  try {
    const { id } = req.params;

    const plant = await prisma.plant.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            tanks: true,
            alerts: true,
            tickets: true,
            users: true,
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

    const hasLinkedRecords =
      plant._count.tanks > 0 ||
      plant._count.alerts > 0 ||
      plant._count.tickets > 0 ||
      plant._count.users > 0;

    if (hasLinkedRecords) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete plant because it has linked tanks, alerts, tickets or users",
      });
    }

    await prisma.plant.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Plant deleted successfully",
    });
  } catch (error) {
    console.error("Delete plant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete plant",
    });
  }
};

module.exports = {
  createPlant,
  getPlants,
  getPlantById,
  updatePlant,
  deletePlant,
};