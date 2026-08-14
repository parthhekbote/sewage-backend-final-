// PURPOSE:
// This file implements alert CRUD, acknowledgement, and resolution controllers.
// It validates alert severity and status values while managing alerts through Prisma.
const prisma = require("../../config/db");

const allowedSeverities = ["WARNING", "CRITICAL"];
const allowedStatuses = ["OPEN", "ACKNOWLEDGED", "RESOLVED"];

// CREATE ALERT
const createAlert = async (req, res) => {
  try {
    const {
      title,
      description,
      severity,
      plantId,
      sensorId,
    } = req.body;

    if (!title || !severity || !plantId) {
      return res.status(400).json({
        success: false,
        message: "Title, severity and plantId are required",
      });
    }

    if (!allowedSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        message: "Severity must be WARNING or CRITICAL",
      });
    }

    const plant = await prisma.plant.findUnique({
      where: { id: plantId },
    });

    if (!plant) {
      return res.status(404).json({
        success: false,
        message: "Plant not found",
      });
    }

    if (sensorId) {
      const sensor = await prisma.sensor.findUnique({
        where: { id: sensorId },
        include: {
          tank: {
            select: {
              plantId: true,
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

      if (sensor.tank.plantId !== plantId) {
        return res.status(400).json({
          success: false,
          message: "Sensor does not belong to the selected plant",
        });
      }
    }

    const alert = await prisma.alert.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        severity,
        plantId,
        sensorId: sensorId || null,
      },
      include: {
        plant: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        sensor: {
          select: {
            id: true,
            name: true,
            type: true,
            unit: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Alert created successfully",
      alert,
    });
  } catch (error) {
    console.error("Create alert error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create alert",
    });
  }
};

// GET ALL ALERTS
const getAlerts = async (req, res) => {
  try {
    const {
      search = "",
      plantId,
      sensorId,
      status,
      severity,
      page = "1",
      limit = "20",
    } = req.query;

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert status",
      });
    }

    if (severity && !allowedSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert severity",
      });
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 20, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      ...(plantId && { plantId }),
      ...(sensorId && { sensorId }),
      ...(status && { status }),
      ...(severity && { severity }),
      ...(search && {
        OR: [
          {
            title: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            description: {
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
          {
            sensor: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        ],
      }),
    };

    const [alerts, total] = await prisma.$transaction([
      prisma.alert.findMany({
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
              users: {
                where: {
                  role: {
                    in: ["ENGINEER", "OPERATOR"],
                  },
                },
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  role: true,
                  status: true,
                },
              },
              building: {
                select: {
                  organization: {
                    select: {
                      id: true,
                      name: true,
                      contactPersonName: true,
                      email: true,
                      phone: true,
                      users: {
                        where: {
                          role: "CLIENT",
                        },
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
                  },
                },
              },
            },
          },
          sensor: {
            select: {
              id: true,
              name: true,
              type: true,
              unit: true,
            },
          },
          _count: {
            select: {
              tickets: true,
            },
          },
        },
      }),

      prisma.alert.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      alerts,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get alerts error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch alerts",
    });
  }
};

// GET ALERT BY ID
const getAlertById = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.findUnique({
      where: { id },
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
        sensor: {
          include: {
            tank: true,
          },
        },
        tickets: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    return res.status(200).json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error("Get alert by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch alert",
    });
  }
};

// UPDATE ALERT DETAILS
const updateAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      severity,
      plantId,
      sensorId,
    } = req.body;

    const existingAlert = await prisma.alert.findUnique({
      where: { id },
    });

    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    if (severity && !allowedSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert severity",
      });
    }

    const finalPlantId = plantId || existingAlert.plantId;

    if (plantId) {
      const plant = await prisma.plant.findUnique({
        where: { id: plantId },
      });

      if (!plant) {
        return res.status(404).json({
          success: false,
          message: "Plant not found",
        });
      }
    }

    if (sensorId) {
      const sensor = await prisma.sensor.findUnique({
        where: { id: sensorId },
        include: {
          tank: {
            select: {
              plantId: true,
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

      if (sensor.tank.plantId !== finalPlantId) {
        return res.status(400).json({
          success: false,
          message: "Sensor does not belong to the selected plant",
        });
      }
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        ...(title !== undefined && {
          title: title.trim(),
        }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
        ...(severity !== undefined && {
          severity,
        }),
        ...(plantId !== undefined && {
          plantId,
        }),
        ...(sensorId !== undefined && {
          sensorId: sensorId || null,
        }),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Alert updated successfully",
      alert,
    });
  } catch (error) {
    console.error("Update alert error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update alert",
    });
  }
};

// ACKNOWLEDGE ALERT
const acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;

    const existingAlert = await prisma.alert.findUnique({
      where: { id },
    });

    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    if (existingAlert.status === "RESOLVED") {
      return res.status(409).json({
        success: false,
        message: "Resolved alert cannot be acknowledged",
      });
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        status: "ACKNOWLEDGED",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Alert acknowledged successfully",
      alert,
    });
  } catch (error) {
    console.error("Acknowledge alert error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to acknowledge alert",
    });
  }
};

// RESOLVE ALERT
const resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;

    const existingAlert = await prisma.alert.findUnique({
      where: { id },
    });

    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    if (existingAlert.status === "RESOLVED") {
      return res.status(409).json({
        success: false,
        message: "Alert is already resolved",
      });
    }

    const alert = await prisma.alert.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Alert resolved successfully",
      alert,
    });
  } catch (error) {
    console.error("Resolve alert error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to resolve alert",
    });
  }
};

// DELETE ALERT
const deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tickets: true,
          },
        },
      },
    });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found",
      });
    }

    if (alert._count.tickets > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete alert because it has linked tickets",
      });
    }

    await prisma.alert.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Alert deleted successfully",
    });
  } catch (error) {
    console.error("Delete alert error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete alert",
    });
  }
};

module.exports = {
  createAlert,
  getAlerts,
  getAlertById,
  updateAlert,
  acknowledgeAlert,
  resolveAlert,
  deleteAlert,
};
