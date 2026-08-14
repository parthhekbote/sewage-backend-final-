// PURPOSE:
// This file implements sensor-reading creation, retrieval, and deletion controllers.
// It manages readings and their sensor relationships through Prisma.
const prisma = require("../../config/db");

// CREATE SENSOR READING
const createSensorReading = async (req, res) => {
  try {
    const { value, sensorId, recordedAt } = req.body;

    if (value === undefined || !sensorId) {
      return res.status(400).json({
        success: false,
        message: "Value and sensorId are required",
      });
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue)) {
      return res.status(400).json({
        success: false,
        message: "Value must be a valid number",
      });
    }

    const sensor = await prisma.sensor.findUnique({
      where: {
        id: sensorId,
      },
    });

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: "Sensor not found",
      });
    }

    let parsedRecordedAt;

    if (recordedAt) {
      parsedRecordedAt = new Date(recordedAt);

      if (Number.isNaN(parsedRecordedAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid recordedAt date",
        });
      }
    }

    const reading = await prisma.sensorReading.create({
      data: {
        value: parsedValue,
        sensorId,
        ...(parsedRecordedAt && {
          recordedAt: parsedRecordedAt,
        }),
      },
      include: {
        sensor: {
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
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Sensor reading created successfully",
      reading,
    });
  } catch (error) {
    console.error("Create sensor reading error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create sensor reading",
    });
  }
};

// GET SENSOR READINGS
const getSensorReadings = async (req, res) => {
  try {
    const {
      sensorId,
      plantId,
      from,
      to,
      page = "1",
      limit = "50",
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);

    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 50, 1),
      500
    );

    const skip = (pageNumber - 1) * limitNumber;

    const recordedAt = {};

    if (from) {
      const fromDate = new Date(from);

      if (Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid from date",
        });
      }

      recordedAt.gte = fromDate;
    }

    if (to) {
      const toDate = new Date(to);

      if (Number.isNaN(toDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid to date",
        });
      }

      recordedAt.lte = toDate;
    }

    const where = {
      ...(sensorId && {
        sensorId,
      }),
      ...(plantId && {
        sensor: {
          tank: {
            plantId,
          },
        },
      }),
      ...(Object.keys(recordedAt).length > 0 && {
        recordedAt,
      }),
    };

    const [readings, total] = await prisma.$transaction([
      prisma.sensorReading.findMany({
        where,
        skip,
        take: limitNumber,
        orderBy: {
          recordedAt: "desc",
        },
        include: {
          sensor: {
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
          },
        },
      }),

      prisma.sensorReading.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      readings,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get sensor readings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sensor readings",
    });
  }
};

// GET SENSOR READING BY ID
const getSensorReadingById = async (req, res) => {
  try {
    const { id } = req.params;

    const reading = await prisma.sensorReading.findUnique({
      where: {
        id,
      },
      include: {
        sensor: {
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
          },
        },
      },
    });

    if (!reading) {
      return res.status(404).json({
        success: false,
        message: "Sensor reading not found",
      });
    }

    return res.status(200).json({
      success: true,
      reading,
    });
  } catch (error) {
    console.error("Get sensor reading by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sensor reading",
    });
  }
};

// DELETE SENSOR READING
const deleteSensorReading = async (req, res) => {
  try {
    const { id } = req.params;

    const reading = await prisma.sensorReading.findUnique({
      where: {
        id,
      },
    });

    if (!reading) {
      return res.status(404).json({
        success: false,
        message: "Sensor reading not found",
      });
    }

    await prisma.sensorReading.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Sensor reading deleted successfully",
    });
  } catch (error) {
    console.error("Delete sensor reading error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete sensor reading",
    });
  }
};

module.exports = {
  createSensorReading,
  getSensorReadings,
  getSensorReadingById,
  deleteSensorReading,
};
