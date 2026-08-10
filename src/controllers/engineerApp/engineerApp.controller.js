const prisma = require("../../config/db");

const engineerSensorTypes = [
  "PH",
  "TSS",
  "BOD",
  "COD",
  "DISSOLVED_OXYGEN",
  "TURBIDITY",
  "H2S",
  "TEMPERATURE",
];

const getAssignedEngineerPlantId = async (engineerId) => {
  const engineer = await prisma.user.findFirst({
    where: {
      id: engineerId,
      role: "ENGINEER",
    },
    select: {
      plantId: true,
    },
  });

  return engineer?.plantId || null;
};

const getDashboard = async (req, res) => {
  try {
    const engineer = await prisma.user.findFirst({
      where: {
        id: req.user.id,
        role: "ENGINEER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        plantId: true,
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
    });

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      });
    }

    const plantId = engineer.plantId;

    const [
      openTicketCount,
      activeAlertCount,
      operatorCount,
      sensorCount,
      recentTickets,
    ] = await Promise.all([
      prisma.ticket.count({
        where: {
          assignedEngineerId: engineer.id,
          status: {
            in: ["OPEN", "ASSIGNED", "IN_PROGRESS"],
          },
        },
      }),

      plantId
        ? prisma.alert.count({
            where: {
              plantId,
              status: {
                in: ["OPEN", "ACKNOWLEDGED"],
              },
            },
          })
        : Promise.resolve(0),

      plantId
        ? prisma.user.count({
            where: {
              plantId,
              role: "OPERATOR",
              status: "ACTIVE",
            },
          })
        : Promise.resolve(0),

      plantId
        ? prisma.sensor.count({
            where: {
              tank: {
                plantId,
              },
            },
          })
        : Promise.resolve(0),

      prisma.ticket.findMany({
        where: {
          assignedEngineerId: engineer.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        include: {
          plant: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          alert: {
            select: {
              id: true,
              title: true,
              severity: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      engineer: {
        id: engineer.id,
        name: engineer.name,
        email: engineer.email,
        phone: engineer.phone,
        status: engineer.status,
      },
      assignedPlant: engineer.plant,
      metrics: {
        openTicketCount,
        activeAlertCount,
        operatorCount,
        sensorCount,
      },
      recentTickets,
    });
  } catch (error) {
    console.error("Get Engineer dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Engineer dashboard",
    });
  }
};

const getTickets = async (req, res) => {
  try {
    const {
      search = "",
      status,
      priority,
      page = "1",
      limit = "20",
    } = req.query;

    const allowedStatuses = [
      "OPEN",
      "ASSIGNED",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
    ];

    const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket status",
      });
    }

    if (priority && !allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket priority",
      });
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 20, 1),
      100
    );

    const where = {
      assignedEngineerId: req.user.id,
      ...(status && { status }),
      ...(priority && { priority }),
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
        ],
      }),
    };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip: (pageNumber - 1) * limitNumber,
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
              address: true,
              city: true,
              state: true,
            },
          },
          alert: {
            select: {
              id: true,
              title: true,
              description: true,
              severity: true,
              status: true,
              sensorId: true,
            },
          },
          workReports: {
            where: {
              engineerId: req.user.id,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      }),

      prisma.ticket.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      tickets,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get Engineer tickets error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tickets",
    });
  }
};

const getTicketById = async (req, res) => {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: req.params.id,
        assignedEngineerId: req.user.id,
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
                    address: true,
                    phone: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        alert: {
          include: {
            sensor: {
              include: {
                tank: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        workReports: {
          where: {
            engineerId: req.user.id,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error("Get Engineer ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ticket",
    });
  }
};

const getPlants = async (req, res) => {
  try {
    const plants = await prisma.plant.findMany({
      where: {
        status: "ACTIVE",
        users: {
          some: {
            id: req.user.id,
            role: "ENGINEER",
          },
        },
      },
      orderBy: {
        name: "asc",
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
        metrics: true,
        _count: {
          select: {
            tanks: true,
            alerts: true,
            tickets: true,
            users: true,
            tasks: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      count: plants.length,
      plants,
    });
  } catch (error) {
    console.error("Get Engineer plants error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plants",
    });
  }
};

const getPlantById = async (req, res) => {
  try {
    const plant = await prisma.plant.findFirst({
      where: {
        id: req.params.id,
        status: "ACTIVE",
        users: {
          some: {
            id: req.user.id,
            role: "ENGINEER",
          },
        },
      },
      include: {
        building: {
          include: {
            organization: true,
          },
        },
        metrics: true,
        tanks: {
          orderBy: {
            name: "asc",
          },
          include: {
            sensors: {
              orderBy: {
                name: "asc",
              },
              include: {
                readings: {
                  orderBy: {
                    recordedAt: "desc",
                  },
                  take: 1,
                },
              },
            },
          },
        },
        alerts: {
          where: {
            status: {
              in: ["OPEN", "ACKNOWLEDGED"],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
          include: {
            sensor: {
              select: {
                id: true,
                name: true,
                type: true,
                unit: true,
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
            tasks: true,
          },
        },
      },
    });

    if (!plant) {
      return res.status(404).json({
        success: false,
        message: "Plant not found or not assigned to this engineer",
      });
    }

    const [
      enabledSensorCount,
      activeAlertCount,
      openTicketCount,
      activeOperatorCount,
      activeTaskCount,
    ] = await Promise.all([
      prisma.sensor.count({
        where: {
          enabled: true,
          tank: {
            plantId: plant.id,
          },
        },
      }),

      prisma.alert.count({
        where: {
          plantId: plant.id,
          status: {
            in: ["OPEN", "ACKNOWLEDGED"],
          },
        },
      }),

      prisma.ticket.count({
        where: {
          plantId: plant.id,
          status: {
            in: ["OPEN", "ASSIGNED", "IN_PROGRESS"],
          },
        },
      }),

      prisma.user.count({
        where: {
          plantId: plant.id,
          role: "OPERATOR",
          status: "ACTIVE",
        },
      }),

      prisma.task.count({
        where: {
          plantId: plant.id,
          status: {
            in: ["PENDING", "IN_PROGRESS"],
          },
        },
      }),
    ]);

    const commissioningDate = plant.commissioningDate;
    let operationalAgeYears = null;

    if (commissioningDate) {
      const ageMilliseconds =
        Date.now() - new Date(commissioningDate).getTime();

      operationalAgeYears = Number(
        (ageMilliseconds / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1)
      );
    }

    return res.status(200).json({
      success: true,
      plant: {
        ...plant,
        summary: {
          operationalAgeYears,
          tankCount: plant._count.tanks,
          configuredSensorCount: plant.tanks.reduce(
            (total, tank) => total + tank.sensors.length,
            0
          ),
          enabledSensorCount,
          activeAlertCount,
          openTicketCount,
          activeOperatorCount,
          activeTaskCount,
        },
      },
    });
  } catch (error) {
    console.error("Get Engineer plant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plant",
    });
  }
};

const getSensors = async (req, res) => {
  try {
    const { search = "", type, enabled, tankId } = req.query;

    const engineer = await prisma.user.findFirst({
      where: {
        id: req.user.id,
        role: "ENGINEER",
      },
      select: {
        plantId: true,
      },
    });

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
        sensors: [],
      });
    }

    const where = {
      tank: {
        plantId: engineer.plantId,
      },
      ...(tankId && { tankId }),
      ...(type && { type }),
      ...(enabled !== undefined && {
        enabled: enabled === "true",
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
            tank: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        ],
      }),
    };

    const sensors = await prisma.sensor.findMany({
      where,
      orderBy: [
        {
          tank: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
      include: {
        tank: {
          select: {
            id: true,
            name: true,
            status: true,
            plantId: true,
          },
        },
        readings: {
          orderBy: {
            recordedAt: "desc",
          },
          take: 1,
        },
        _count: {
          select: {
            readings: true,
            alerts: true,
          },
        },
      },
    });

    const mappedSensors = sensors.map((sensor) => {
      const latestReading = sensor.readings[0] || null;
      let condition = "NO_DATA";

      if (latestReading) {
        const belowMinimum =
          sensor.minimumThreshold !== null &&
          latestReading.value < sensor.minimumThreshold;

        const aboveMaximum =
          sensor.maximumThreshold !== null &&
          latestReading.value > sensor.maximumThreshold;

        condition = belowMinimum || aboveMaximum ? "OUT_OF_RANGE" : "NORMAL";
      }

      return {
        ...sensor,
        latestReading,
        condition,
        readings: undefined,
      };
    });

    return res.status(200).json({
      success: true,
      count: mappedSensors.length,
      sensors: mappedSensors,
    });
  } catch (error) {
    console.error("Get Engineer sensors error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sensors",
    });
  }
};

const getAlerts = async (req, res) => {
  try {
    const { status, severity, sensorId } = req.query;

    const engineer = await prisma.user.findFirst({
      where: {
        id: req.user.id,
        role: "ENGINEER",
      },
      select: {
        plantId: true,
      },
    });

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
        alerts: [],
      });
    }

    const alerts = await prisma.alert.findMany({
      where: {
        plantId: engineer.plantId,
        ...(status && { status }),
        ...(severity && { severity }),
        ...(sensorId && { sensorId }),
      },
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
        sensor: {
          include: {
            tank: {
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
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error("Get Engineer alerts error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch alerts",
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const engineer = await prisma.user.findFirst({
      where: {
        id: req.user.id,
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
            address: true,
            city: true,
            state: true,
            pincode: true,
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
    console.error("Get Engineer profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

const getPlantAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { range = "7d", sensorType } = req.query;

    const allowedRanges = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
    };

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

    if (!allowedRanges[range]) {
      return res.status(400).json({
        success: false,
        message: "Invalid range. Use 24h, 7d, 30d, or 90d",
      });
    }

    if (sensorType && !allowedSensorTypes.includes(sensorType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sensor type",
      });
    }

    const plant = await prisma.plant.findFirst({
      where: {
        id,
        users: {
          some: {
            id: req.user.id,
            role: "ENGINEER",
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!plant) {
      return res.status(404).json({
        success: false,
        message: "Plant not found or not assigned to this engineer",
      });
    }

    const to = new Date();
    const from = new Date(to.getTime() - allowedRanges[range]);

    const sensorWhere = {
      tank: {
        plantId: plant.id,
      },
      ...(sensorType && { type: sensorType }),
    };

    const [sensors, readings] = await Promise.all([
      prisma.sensor.findMany({
        where: sensorWhere,
        orderBy: {
          name: "asc",
        },
        include: {
          tank: {
            select: {
              id: true,
              name: true,
            },
          },
          readings: {
            orderBy: {
              recordedAt: "desc",
            },
            take: 1,
          },
        },
      }),

      prisma.sensorReading.findMany({
        where: {
          recordedAt: {
            gte: from,
            lte: to,
          },
          sensor: sensorWhere,
        },
        orderBy: {
          recordedAt: "asc",
        },
        select: {
          id: true,
          value: true,
          recordedAt: true,
          sensorId: true,
          sensor: {
            select: {
              name: true,
              type: true,
              unit: true,
            },
          },
        },
      }),
    ]);

    const metrics = sensors.map((sensor) => {
      const latestReading = sensor.readings[0] || null;
      let condition = "NO_DATA";

      if (latestReading) {
        const belowMinimum =
          sensor.minimumThreshold !== null &&
          latestReading.value < sensor.minimumThreshold;

        const aboveMaximum =
          sensor.maximumThreshold !== null &&
          latestReading.value > sensor.maximumThreshold;

        condition = belowMinimum || aboveMaximum ? "OUT_OF_RANGE" : "NORMAL";
      }

      return {
        id: sensor.id,
        name: sensor.name,
        type: sensor.type,
        unit: sensor.unit,
        enabled: sensor.enabled,
        minimumThreshold: sensor.minimumThreshold,
        maximumThreshold: sensor.maximumThreshold,
        tank: sensor.tank,
        latestReading,
        condition,
      };
    });

    const values = readings.map((reading) => reading.value);

    const summary = {
      count: values.length,
      average:
        values.length > 0
          ? Number(
              (
                values.reduce((total, value) => total + value, 0) /
                values.length
              ).toFixed(2)
            )
          : null,
      minimum: values.length > 0 ? Math.min(...values) : null,
      maximum: values.length > 0 ? Math.max(...values) : null,
    };

    return res.status(200).json({
      success: true,
      plantId: plant.id,
      range,
      sensorType: sensorType || null,
      period: {
        from,
        to,
      },
      metrics,
      performance: {
        summary,
        chart: readings,
      },
    });
  } catch (error) {
    console.error("Get Engineer plant analytics error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plant analytics",
    });
  }
};

const createManagedSensor = async (req, res) => {
  try {
    const {
      name,
      type,
      unit,
      tankId,
      minimumThreshold,
      maximumThreshold,
      enabled = true,
    } = req.body;

    if (!name || !type || !unit || !tankId) {
      return res.status(400).json({
        success: false,
        message: "Name, type, unit and tankId are required",
      });
    }

    if (!engineerSensorTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sensor type",
      });
    }

    const plantId = await getAssignedEngineerPlantId(req.user.id);

    if (!plantId) {
      return res.status(400).json({
        success: false,
        message: "Engineer is not assigned to a plant",
      });
    }

    const tank = await prisma.tank.findFirst({
      where: {
        id: tankId,
        plantId,
      },
      select: {
        id: true,
      },
    });

    if (!tank) {
      return res.status(404).json({
        success: false,
        message: "Tank not found in the Engineer's assigned plant",
      });
    }

    const parsedMinimum =
      minimumThreshold === undefined ||
      minimumThreshold === null ||
      minimumThreshold === ""
        ? null
        : Number(minimumThreshold);

    const parsedMaximum =
      maximumThreshold === undefined ||
      maximumThreshold === null ||
      maximumThreshold === ""
        ? null
        : Number(maximumThreshold);

    if (
      (parsedMinimum !== null && !Number.isFinite(parsedMinimum)) ||
      (parsedMaximum !== null && !Number.isFinite(parsedMaximum))
    ) {
      return res.status(400).json({
        success: false,
        message: "Threshold values must be valid numbers",
      });
    }

    if (
      parsedMinimum !== null &&
      parsedMaximum !== null &&
      parsedMinimum > parsedMaximum
    ) {
      return res.status(400).json({
        success: false,
        message: "Minimum threshold cannot exceed maximum threshold",
      });
    }

    const duplicateSensor = await prisma.sensor.findFirst({
      where: {
        tankId,
        name: {
          equals: name.trim(),
          mode: "insensitive",
        },
      },
      select: {
        id: true,
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
        unit: unit.trim(),
        tankId,
        enabled: Boolean(enabled),
        minimumThreshold: parsedMinimum,
        maximumThreshold: parsedMaximum,
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
    console.error("Create managed Sensor error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create sensor",
    });
  }
};

const updateManagedSensor = async (req, res) => {
  try {
    const {
      name,
      type,
      unit,
      tankId,
      enabled,
      minimumThreshold,
      maximumThreshold,
    } = req.body;

    const plantId = await getAssignedEngineerPlantId(req.user.id);

    if (!plantId) {
      return res.status(400).json({
        success: false,
        message: "Engineer is not assigned to a plant",
      });
    }

    const existingSensor = await prisma.sensor.findFirst({
      where: {
        id: req.params.id,
        tank: {
          plantId,
        },
      },
    });

    if (!existingSensor) {
      return res.status(404).json({
        success: false,
        message: "Sensor not found in the Engineer's assigned plant",
      });
    }

    if (type !== undefined && !engineerSensorTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sensor type",
      });
    }

    let finalTankId = existingSensor.tankId;

    if (tankId !== undefined) {
      const tank = await prisma.tank.findFirst({
        where: {
          id: tankId,
          plantId,
        },
        select: {
          id: true,
        },
      });

      if (!tank) {
        return res.status(404).json({
          success: false,
          message: "Tank not found in the Engineer's assigned plant",
        });
      }

      finalTankId = tankId;
    }

    const parseThreshold = (value, currentValue) => {
      if (value === undefined) {
        return currentValue;
      }

      if (value === null || value === "") {
        return null;
      }

      return Number(value);
    };

    const finalMinimum = parseThreshold(
      minimumThreshold,
      existingSensor.minimumThreshold
    );

    const finalMaximum = parseThreshold(
      maximumThreshold,
      existingSensor.maximumThreshold
    );

    if (
      (finalMinimum !== null && !Number.isFinite(finalMinimum)) ||
      (finalMaximum !== null && !Number.isFinite(finalMaximum))
    ) {
      return res.status(400).json({
        success: false,
        message: "Threshold values must be valid numbers",
      });
    }

    if (
      finalMinimum !== null &&
      finalMaximum !== null &&
      finalMinimum > finalMaximum
    ) {
      return res.status(400).json({
        success: false,
        message: "Minimum threshold cannot exceed maximum threshold",
      });
    }

    if (name !== undefined || tankId !== undefined) {
      const duplicateSensor = await prisma.sensor.findFirst({
        where: {
          id: {
            not: existingSensor.id,
          },
          tankId: finalTankId,
          name: {
            equals:
              name !== undefined
                ? name.trim()
                : existingSensor.name,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
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
        id: existingSensor.id,
      },
      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),
        ...(type !== undefined && { type }),
        ...(unit !== undefined && {
          unit: unit.trim(),
        }),
        ...(tankId !== undefined && {
          tankId: finalTankId,
        }),
        ...(enabled !== undefined && {
          enabled: Boolean(enabled),
        }),
        minimumThreshold: finalMinimum,
        maximumThreshold: finalMaximum,
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
    console.error("Update managed Sensor error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update sensor",
    });
  }
};

const startEngineerTicket = async (req, res) => {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: req.params.id,
        assignedEngineerId: req.user.id,
      },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found or not assigned to this engineer",
      });
    }

    if (ticket.status !== "ASSIGNED") {
      return res.status(409).json({
        success: false,
        message: "Only an assigned ticket can be started",
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: {
        id: ticket.id,
      },
      data: {
        status: "IN_PROGRESS",
      },
      include: {
        plant: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        alert: {
          select: {
            id: true,
            title: true,
            severity: true,
            status: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Ticket started successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("Start Engineer ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to start ticket",
    });
  }
};

const resolveEngineerTicket = async (req, res) => {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: req.params.id,
        assignedEngineerId: req.user.id,
      },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found or not assigned to this engineer",
      });
    }

    if (ticket.status !== "IN_PROGRESS") {
      return res.status(409).json({
        success: false,
        message: "Only an in-progress ticket can be resolved",
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: {
        id: ticket.id,
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
      include: {
        plant: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        alert: {
          select: {
            id: true,
            title: true,
            severity: true,
            status: true,
          },
        },
        workReports: {
          where: {
            engineerId: req.user.id,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Ticket resolved successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("Resolve Engineer ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to resolve ticket",
    });
  }
};

const getPlantHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { type = "ALL", status } = req.query;

    const allowedTypes = [
      "ALL",
      "TASK",
      "VISIT_REPORT",
      "WORK_REPORT",
    ];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid history type. Use ALL, TASK, VISIT_REPORT, or WORK_REPORT",
      });
    }

    const plant = await prisma.plant.findFirst({
      where: {
        id,
        users: {
          some: {
            id: req.user.id,
            role: "ENGINEER",
          },
        },
      },
      select: {
        id: true,
        name: true,
        metrics: true,
      },
    });

    if (!plant) {
      return res.status(404).json({
        success: false,
        message: "Plant not found or not assigned to this engineer",
      });
    }

    const [tasks, visitReports, workReports] = await Promise.all([
      type === "ALL" || type === "TASK"
        ? prisma.task.findMany({
            where: {
              plantId: plant.id,
              ...(status &&
  ["PENDING", "IN_PROGRESS", "COMPLETED"].includes(status) && {
    status,
  }),
            },
            include: {
              operator: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
            },
          })
        : Promise.resolve([]),

      type === "ALL" || type === "VISIT_REPORT"
        ? prisma.visitReport.findMany({
            where: {
              plantId: plant.id,
              engineerId: req.user.id,
              ...(status &&
  ["HEALTHY", "NEEDS_ATTENTION", "CRITICAL"].includes(status) && {
    condition: status,
  }),
            },
            include: {
              engineer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
            },
          })
        : Promise.resolve([]),

      type === "ALL" || type === "WORK_REPORT"
        ? prisma.workReport.findMany({
            where: {
              engineerId: req.user.id,
              ticket: {
                plantId: plant.id,
              },
              ...(status &&
  [
    "FIXED",
    "NEEDS_MONITORING",
    "FURTHER_REPAIR_REQUIRED",
  ].includes(status) && {
    equipmentCondition: status,
  }),
            },
            include: {
              engineer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
              ticket: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const taskEvents = tasks.map((task) => ({
      id: task.id,
      type: "TASK",
      title: task.title,
      description: task.description,
      date: task.updatedAt,
      status: task.status,
      performedBy: task.operator,
      parameter: "Activity",
      value: task.description || task.title,
      source: task,
    }));

    const visitEvents = visitReports.map((report) => ({
      id: report.id,
      type: "VISIT_REPORT",
      title: "Plant Inspection",
      description: report.observation,
      date: report.visitedAt,
      status: report.condition,
      performedBy: report.engineer,
      parameter: "Condition",
      value: report.condition,
      source: report,
    }));

    const workEvents = workReports.map((report) => ({
      id: report.id,
      type: "WORK_REPORT",
      title: report.ticket.title,
      description: report.description,
      date: report.updatedAt,
      status: report.equipmentCondition,
      performedBy: report.engineer,
      parameter: "Action",
      value: report.actionsTaken,
      source: report,
    }));

    const combinedEvents = [
  ...taskEvents,
  ...visitEvents,
  ...workEvents,
];

const filteredEvents = status
  ? combinedEvents.filter((event) => event.status === status)
  : combinedEvents;

const events = filteredEvents.sort(
      (first, second) =>
        new Date(second.date).getTime() -
        new Date(first.date).getTime()
    );

    const completedTaskCount = tasks.filter(
      (task) => task.status === "COMPLETED"
    ).length;

    return res.status(200).json({
      success: true,
      plant: {
        id: plant.id,
        name: plant.name,
      },
      summary: {
        totalServices:
          completedTaskCount +
          visitReports.length +
          workReports.length,
        complianceScore:
          plant.metrics?.complianceScore ?? null,
        lastDesludging:
          plant.metrics?.lastDesludging ?? null,
        violations:
          plant.metrics?.violations ?? 0,
      },
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Get Engineer plant history error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plant history",
    });
  }
};

module.exports = {
  getDashboard,
  getTickets,
  getTicketById,
  getPlants,
  getPlantById,
  getSensors,
  getAlerts,
  getProfile,
  getPlantAnalytics,
  createManagedSensor,
updateManagedSensor,
startEngineerTicket,
resolveEngineerTicket,
getPlantHistory,
};
