// PURPOSE:
// This file implements sensor CRUD controller operations.
// It validates sensor types and manages sensors with their tank relationships through Prisma.
const prisma = require("../../config/db");

const allowedSensorTypes = [
  "PH",
  "TSS",
  "BOD",
  "COD",
  "DISSOLVED_OXYGEN",
  "TURBIDITY",
  "H2S",
  "TEMPERATURE",
];

// CREATE SENSOR
const createSensor = async (req, res) => {
  try {
    const {
      name,
      type,
      minimumThreshold,
      maximumThreshold,
      unit,
      tankId,
    } = req.body;

    if (!name || !type || !tankId) {
      return res.status(400).json({
        success: false,
        message: "Name, type and tankId are required",
      });
    }

    if (!allowedSensorTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sensor type",
      });
    }

    let parsedMinimum = null;
    let parsedMaximum = null;

    if (minimumThreshold !== undefined && minimumThreshold !== null) {
      parsedMinimum = Number(minimumThreshold);

      if (!Number.isFinite(parsedMinimum)) {
        return res.status(400).json({
          success: false,
          message: "Minimum threshold must be a valid number",
        });
      }
    }

    if (maximumThreshold !== undefined && maximumThreshold !== null) {
      parsedMaximum = Number(maximumThreshold);

      if (!Number.isFinite(parsedMaximum)) {
        return res.status(400).json({
          success: false,
          message: "Maximum threshold must be a valid number",
        });
      }
    }

    if (
      parsedMinimum !== null &&
      parsedMaximum !== null &&
      parsedMinimum >= parsedMaximum
    ) {
      return res.status(400).json({
        success: false,
        message: "Minimum threshold must be less than maximum threshold",
      });
    }

    const tank = await prisma.tank.findUnique({
      where: {
        id: tankId,
      },
    });

    if (!tank) {
      return res.status(404).json({
        success: false,
        message: "Tank not found",
      });
    }

    const duplicateSensor = await prisma.sensor.findFirst({
      where: {
        tankId,
        name: name.trim(),
      },
    });

    if (duplicateSensor) {
      return res.status(409).json({
        success: false,
        message: "A sensor with this name already exists in the tank",
      });
    }

    const sensor = await prisma.sensor.create({
      data: {
        name: name.trim(),
        type,
        minimumThreshold: parsedMinimum,
        maximumThreshold: parsedMaximum,
        unit: unit?.trim() || null,
        tankId,
      },
      include: {
        tank: {
          include: {
            plant: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Sensor created successfully",
      sensor,
    });
  } catch (error) {
    console.error("Create sensor error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create sensor",
    });
  }
};

// GET ALL SENSORS
const getSensors = async (req, res) => {
  try {
    const {
      search = "",
      tankId,
      plantId,
      type,
      page = "1",
      limit = "10",
    } = req.query;

    if (type && !allowedSensorTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sensor type",
      });
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      ...(tankId && { tankId }),
      ...(plantId && {
        tank: {
          plantId,
        },
      }),
      ...(type && { type }),
      ...(search && {
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            unit: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            tank: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
          {
            tank: {
              plant: {
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

    const [sensors, total] = await prisma.$transaction([
      prisma.sensor.findMany({
        where,
        skip,
        take: limitNumber,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          tank: {
            include: {
              plant: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          _count: {
            select: {
              readings: true,
              alerts: true,
            },
          },
        },
      }),

      prisma.sensor.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      sensors,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get sensors error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sensors",
    });
  }
};

// GET SENSOR BY ID
const getSensorById = async (req, res) => {
  try {
    const { id } = req.params;

    const sensor = await prisma.sensor.findUnique({
      where: {
        id,
      },
      include: {
        tank: {
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
          },
        },
        readings: {
          orderBy: {
            recordedAt: "desc",
          },
          take: 50,
        },
        alerts: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: "Sensor not found",
      });
    }

    return res.status(200).json({
      success: true,
      sensor,
    });
  } catch (error) {
    console.error("Get sensor by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sensor",
    });
  }
};

// UPDATE SENSOR
const updateSensor = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      type,
      minimumThreshold,
      maximumThreshold,
      unit,
      tankId,
    } = req.body;

    const existingSensor = await prisma.sensor.findUnique({
      where: {
        id,
      },
    });

    if (!existingSensor) {
      return res.status(404).json({
        success: false,
        message: "Sensor not found",
      });
    }

    if (type && !allowedSensorTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sensor type",
      });
    }

    if (tankId) {
      const tank = await prisma.tank.findUnique({
        where: {
          id: tankId,
        },
      });

      if (!tank) {
        return res.status(404).json({
          success: false,
          message: "Tank not found",
        });
      }
    }

    let parsedMinimum;
    let parsedMaximum;

    if (minimumThreshold !== undefined) {
      if (minimumThreshold === null || minimumThreshold === "") {
        parsedMinimum = null;
      } else {
        parsedMinimum = Number(minimumThreshold);

        if (!Number.isFinite(parsedMinimum)) {
          return res.status(400).json({
            success: false,
            message: "Minimum threshold must be a valid number",
          });
        }
      }
    }

    if (maximumThreshold !== undefined) {
      if (maximumThreshold === null || maximumThreshold === "") {
        parsedMaximum = null;
      } else {
        parsedMaximum = Number(maximumThreshold);

        if (!Number.isFinite(parsedMaximum)) {
          return res.status(400).json({
            success: false,
            message: "Maximum threshold must be a valid number",
          });
        }
      }
    }

    const finalMinimum =
      minimumThreshold !== undefined
        ? parsedMinimum
        : existingSensor.minimumThreshold;

    const finalMaximum =
      maximumThreshold !== undefined
        ? parsedMaximum
        : existingSensor.maximumThreshold;

    if (
      finalMinimum !== null &&
      finalMaximum !== null &&
      finalMinimum >= finalMaximum
    ) {
      return res.status(400).json({
        success: false,
        message: "Minimum threshold must be less than maximum threshold",
      });
    }

    const finalTankId = tankId || existingSensor.tankId;
    const finalName = name?.trim() || existingSensor.name;

    if (name !== undefined || tankId !== undefined) {
      const duplicateSensor = await prisma.sensor.findFirst({
        where: {
          id: {
            not: id,
          },
          tankId: finalTankId,
          name: finalName,
        },
      });

      if (duplicateSensor) {
        return res.status(409).json({
          success: false,
          message: "A sensor with this name already exists in the tank",
        });
      }
    }

    const sensor = await prisma.sensor.update({
      where: {
        id,
      },
      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),
        ...(type !== undefined && {
          type,
        }),
        ...(minimumThreshold !== undefined && {
          minimumThreshold: parsedMinimum,
        }),
        ...(maximumThreshold !== undefined && {
          maximumThreshold: parsedMaximum,
        }),
        ...(unit !== undefined && {
          unit: unit?.trim() || null,
        }),
        ...(tankId !== undefined && {
          tankId,
        }),
      },
      include: {
        tank: {
          include: {
            plant: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Sensor updated successfully",
      sensor,
    });
  } catch (error) {
    console.error("Update sensor error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update sensor",
    });
  }
};

// DELETE SENSOR
const deleteSensor = async (req, res) => {
  try {
    const { id } = req.params;

    const sensor = await prisma.sensor.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            readings: true,
            alerts: true,
          },
        },
      },
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: "Sensor not found",
      });
    }

    if (
      sensor._count.readings > 0 ||
      sensor._count.alerts > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete sensor because it has linked readings or alerts",
      });
    }

    await prisma.sensor.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Sensor deleted successfully",
    });
  } catch (error) {
    console.error("Delete sensor error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete sensor",
    });
  }
};

module.exports = {
  createSensor,
  getSensors,
  getSensorById,
  updateSensor,
  deleteSensor,
};
