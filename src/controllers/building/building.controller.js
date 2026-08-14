// PURPOSE:
// This file implements building CRUD controller operations.
// It manages buildings and their organization relationships through Prisma.
const prisma = require("../../config/db");

// CREATE BUILDING
const createBuilding = async (req, res) => {
  try {
    const { name, location, organizationId } = req.body;

    if (!name || !location || !organizationId) {
      return res.status(400).json({
        success: false,
        message: "Name, location and organizationId are required",
      });
    }

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

    const duplicateBuilding = await prisma.building.findFirst({
      where: {
        name: name.trim(),
        organizationId,
      },
    });

    if (duplicateBuilding) {
      return res.status(409).json({
        success: false,
        message:
          "A building with this name already exists in the organization",
      });
    }

    const building = await prisma.building.create({
      data: {
        name: name.trim(),
        location: location.trim(),
        organizationId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Building created successfully",
      building,
    });
  } catch (error) {
    console.error("Create building error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create building",
    });
  }
};

// GET ALL BUILDINGS
const getBuildings = async (req, res) => {
  try {
    const {
      search = "",
      organizationId,
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
      ...(organizationId && {
        organizationId,
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
            location: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            organization: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        ],
      }),
    };

    const [buildings, total] = await prisma.$transaction([
      prisma.building.findMany({
        where,
        skip,
        take: limitNumber,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              plants: true,
            },
          },
        },
      }),

      prisma.building.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      buildings,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get buildings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch buildings",
    });
  }
};

// GET BUILDING BY ID
const getBuildingById = async (req, res) => {
  try {
    const { id } = req.params;

    const building = await prisma.building.findUnique({
      where: {
        id,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        plants: true,
      },
    });

    if (!building) {
      return res.status(404).json({
        success: false,
        message: "Building not found",
      });
    }

    return res.status(200).json({
      success: true,
      building,
    });
  } catch (error) {
    console.error("Get building by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch building",
    });
  }
};

// UPDATE BUILDING
const updateBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, organizationId } = req.body;

    const existingBuilding = await prisma.building.findUnique({
      where: {
        id,
      },
    });

    if (!existingBuilding) {
      return res.status(404).json({
        success: false,
        message: "Building not found",
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

    const finalOrganizationId =
      organizationId || existingBuilding.organizationId;

    if (name) {
      const duplicateBuilding = await prisma.building.findFirst({
        where: {
          id: {
            not: id,
          },
          name: name.trim(),
          organizationId: finalOrganizationId,
        },
      });

      if (duplicateBuilding) {
        return res.status(409).json({
          success: false,
          message:
            "A building with this name already exists in the organization",
        });
      }
    }

    const building = await prisma.building.update({
      where: {
        id,
      },
      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),
        ...(location !== undefined && {
          location: location.trim(),
        }),
        ...(organizationId !== undefined && {
          organizationId,
        }),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Building updated successfully",
      building,
    });
  } catch (error) {
    console.error("Update building error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update building",
    });
  }
};

// DELETE BUILDING
const deleteBuilding = async (req, res) => {
  try {
    const { id } = req.params;

    const building = await prisma.building.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            plants: true,
          },
        },
      },
    });

    if (!building) {
      return res.status(404).json({
        success: false,
        message: "Building not found",
      });
    }

    if (building._count.plants > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete building because it has linked plants",
      });
    }

    await prisma.building.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Building deleted successfully",
    });
  } catch (error) {
    console.error("Delete building error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete building",
    });
  }
};

module.exports = {
  createBuilding,
  getBuildings,
  getBuildingById,
  updateBuilding,
  deleteBuilding,
};
