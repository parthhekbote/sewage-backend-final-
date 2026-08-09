const fs = require("fs");
const path = require("path");
const prisma = require("../../config/db");
const { uploadDirectory } = require("../../middleware/tankerReceiptUpload.middleware");
const {
  taskEvidenceDirectory,
} = require("../../middleware/taskEvidenceUpload.middleware");

const taskInclude = {
  plant: { select: { id: true, name: true, code: true } },
  operator: { select: { id: true, name: true, phone: true, status: true } },
};

const alertInclude = {
  plant: { select: { id: true, name: true, code: true } },
  sensor: {
    select: {
      id: true,
      name: true,
      type: true,
      unit: true,
      tank: { select: { id: true, name: true } },
    },
  },
};

const findOperator = (id) =>
  prisma.user.findFirst({
    where: { id, role: "OPERATOR" },
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
      organization: { select: { id: true, name: true } },
      plant: {
        include: {
          metrics: true,
          tanks: {
            orderBy: { name: "asc" },
            include: {
              pumps: { orderBy: { name: "asc" } },
              sensors: {
                orderBy: { type: "asc" },
                include: {
                  readings: { orderBy: { recordedAt: "desc" }, take: 1 },
                },
              },
            },
          },
          building: {
            include: {
              organization: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

const getDashboard = async (req, res) => {
  try {
    const operator = await findOperator(req.user.id);
    if (!operator) {
      return res.status(404).json({ success: false, message: "Operator not found" });
    }

    const plantId = operator.plantId;
    const [pendingTaskCount, inProgressTaskCount, activeAlertCount, sensorCount, recentTasks, activeAlerts] =
      await Promise.all([
        prisma.task.count({ where: { operatorId: operator.id, status: "PENDING" } }),
        prisma.task.count({ where: { operatorId: operator.id, status: "IN_PROGRESS" } }),
        plantId
          ? prisma.alert.count({ where: { plantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } } })
          : Promise.resolve(0),
        plantId
          ? prisma.sensor.count({ where: { tank: { plantId }, enabled: true } })
          : Promise.resolve(0),
        prisma.task.findMany({
          where: { operatorId: operator.id },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 5,
          include: taskInclude,
        }),
        plantId
          ? prisma.alert.findMany({
              where: { plantId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
              orderBy: { createdAt: "desc" },
              take: 3,
              include: alertInclude,
            })
          : Promise.resolve([]),
      ]);

    return res.status(200).json({
      success: true,
      operator: {
        id: operator.id,
        name: operator.name,
        email: operator.email,
        phone: operator.phone,
        status: operator.status,
      },
      assignedPlant: operator.plant,
      metrics: { pendingTaskCount, inProgressTaskCount, activeAlertCount, sensorCount },
      recentTasks,
      activeAlerts,
    });
  } catch (error) {
    console.error("Get Operator dashboard error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch Operator dashboard" });
  }
};

const getProfile = async (req, res) => {
  try {
    const operator = await findOperator(req.user.id);
    if (!operator) {
      return res.status(404).json({ success: false, message: "Operator not found" });
    }
    return res.status(200).json({ success: true, operator });
  } catch (error) {
    console.error("Get Operator profile error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch Operator profile" });
  }
};

const getPlant = async (req, res) => {
  try {
    if (!req.user.plantId) return res.status(200).json({ success: true, plant: null });

    const plant = await prisma.plant.findFirst({
      where: { id: req.user.plantId, users: { some: { id: req.user.id } } },
      include: {
        building: { include: { organization: true } },
        metrics: true,
        tanks: {
          orderBy: { name: "asc" },
          include: {
            pumps: { orderBy: { name: "asc" } },
            sensors: {
              orderBy: { type: "asc" },
              include: { readings: { orderBy: { recordedAt: "desc" }, take: 1 } },
            },
          },
        },
        _count: { select: { tanks: true, alerts: true, tasks: true } },
      },
    });

    if (!plant) {
      return res.status(404).json({ success: false, message: "Assigned plant not found" });
    }
    return res.status(200).json({ success: true, plant });
  } catch (error) {
    console.error("Get Operator plant error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch assigned plant" });
  }
};

const getAlerts = async (req, res) => {
  try {
    const { status, severity } = req.query;
    if (status && !["OPEN", "ACKNOWLEDGED", "RESOLVED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid alert status" });
    }
    if (severity && !["WARNING", "CRITICAL"].includes(severity)) {
      return res.status(400).json({ success: false, message: "Invalid alert severity" });
    }
    if (!req.user.plantId) {
      return res.status(200).json({ success: true, count: 0, alerts: [] });
    }

    const alerts = await prisma.alert.findMany({
      where: { plantId: req.user.plantId, ...(status && { status }), ...(severity && { severity }) },
      orderBy: { createdAt: "desc" },
      include: alertInclude,
    });
    return res.status(200).json({ success: true, count: alerts.length, alerts });
  } catch (error) {
    console.error("Get Operator alerts error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch alerts" });
  }
};

const resolveAlert = async (req, res) => {
  try {
    if (!req.user.plantId) {
      return res.status(400).json({ success: false, message: "Operator is not assigned to a plant" });
    }
    const alert = await prisma.alert.findFirst({
      where: { id: req.params.id, plantId: req.user.plantId },
    });
    if (!alert) {
      return res.status(404).json({ success: false, message: "Alert not found" });
    }
    if (alert.status === "RESOLVED") {
      return res.status(409).json({ success: false, message: "Alert is already resolved" });
    }
    const updatedAlert = await prisma.alert.update({
      where: { id: alert.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
      include: alertInclude,
    });
    return res.status(200).json({
      success: true,
      message: "Alert resolved successfully",
      alert: updatedAlert,
    });
  } catch (error) {
    console.error("Resolve Operator alert error:", error);
    return res.status(500).json({ success: false, message: "Failed to resolve alert" });
  }
};

const getTasks = async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !["PENDING", "IN_PROGRESS", "COMPLETED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid task status" });
    }
    const tasks = await prisma.task.findMany({
      where: { operatorId: req.user.id, ...(status && { status }) },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      include: taskInclude,
    });
    return res.status(200).json({ success: true, count: tasks.length, tasks });
  } catch (error) {
    console.error("Get Operator tasks error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch tasks" });
  }
};

const getTaskById = async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, operatorId: req.user.id },
      include: taskInclude,
    });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    return res.status(200).json({ success: true, task });
  } catch (error) {
    console.error("Get Operator task error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch task" });
  }
};

const changeTaskStatus = async (req, res, from, to, message) => {
  const task = await prisma.task.findFirst({ where: { id: req.params.id, operatorId: req.user.id } });
  if (!task) return res.status(404).json({ success: false, message: "Task not found" });
  if (task.status !== from) {
    return res.status(409).json({ success: false, message: `Task must be ${from}` });
  }
  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: { status: to },
    include: taskInclude,
  });
  return res.status(200).json({ success: true, message, task: updatedTask });
};

const startTask = async (req, res) => {
  try {
    return await changeTaskStatus(req, res, "PENDING", "IN_PROGRESS", "Task started successfully");
  } catch (error) {
    console.error("Start Operator task error:", error);
    return res.status(500).json({ success: false, message: "Failed to start task" });
  }
};

const completeTask = async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, operatorId: req.user.id },
    });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    if (task.status !== "IN_PROGRESS") {
      return res.status(409).json({ success: false, message: "Task must be IN_PROGRESS" });
    }

    const completionNote = req.body.completionNote?.trim() || null;
    const imageUrls = req.body.imageUrls;
    if (imageUrls !== undefined && (!Array.isArray(imageUrls) || imageUrls.some((value) => typeof value !== "string"))) {
      return res.status(400).json({ success: false, message: "imageUrls must be an array of strings" });
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        completionNote,
        imageUrls: imageUrls || [],
      },
      include: taskInclude,
    });
    return res.status(200).json({
      success: true,
      message: "Task completed successfully",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Complete Operator task error:", error);
    return res.status(500).json({ success: false, message: "Failed to complete task" });
  }
};

const uploadTaskEvidence = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Task image is required" });
  }

  return res.status(201).json({
    success: true,
    imageUrl: `/api/operator/task-evidence/${req.file.filename}`,
  });
};

const getTaskEvidence = async (req, res) => {
  const filename = path.basename(req.params.filename);
  if (filename !== req.params.filename || !filename.startsWith(`${req.user.id}-`)) {
    return res.status(404).json({ success: false, message: "Task image not found" });
  }

  const imageUrl = `/api/operator/task-evidence/${filename}`;
  const task = await prisma.task.findFirst({
    where: { operatorId: req.user.id, imageUrls: { has: imageUrl } },
    select: { id: true },
  });
  const filePath = path.join(taskEvidenceDirectory, filename);

  if (!task || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "Task image not found" });
  }

  return res.sendFile(filePath);
};

const tankerLogInclude = {
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
  operator: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
};

const createTankerLog = async (req, res) => {
  try {
    const {
      tankerNumber,
      agency,
      volume,
      receiptImageUrl,
      latitude,
      longitude,
      loggedAt,
    } = req.body;

    if (!req.user.plantId) {
      return res.status(400).json({
        success: false,
        message: "Operator is not assigned to a plant",
      });
    }

    const normalizedTankerNumber =
      typeof tankerNumber === "string"
        ? tankerNumber.trim().toUpperCase()
        : "";

    const normalizedAgency =
      typeof agency === "string" ? agency.trim() : "";

    const parsedVolume = Number(volume);

    if (normalizedTankerNumber.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid tanker number",
      });
    }

    if (!normalizedAgency) {
      return res.status(400).json({
        success: false,
        message: "Agency is required",
      });
    }

    if (!Number.isFinite(parsedVolume) || parsedVolume <= 0) {
      return res.status(400).json({
        success: false,
        message: "Volume must be greater than zero",
      });
    }

    if (
      receiptImageUrl !== undefined &&
      receiptImageUrl !== null &&
      typeof receiptImageUrl !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Receipt image URL must be a string",
      });
    }

    const normalizedReceiptImageUrl =
      typeof receiptImageUrl === "string" ? receiptImageUrl.trim() : "";

    if (
      normalizedReceiptImageUrl &&
      !normalizedReceiptImageUrl.startsWith(
        `/api/operator/tanker-receipts/${req.user.id}-`
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid receipt image URL",
      });
    }

    const parsedLatitude =
      latitude === undefined || latitude === null
        ? null
        : Number(latitude);

    const parsedLongitude =
      longitude === undefined || longitude === null
        ? null
        : Number(longitude);

    const parsedLoggedAt = loggedAt ? new Date(loggedAt) : new Date();
    if (Number.isNaN(parsedLoggedAt.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid loggedAt date" });
    }

    if (
      parsedLatitude !== null &&
      (!Number.isFinite(parsedLatitude) ||
        parsedLatitude < -90 ||
        parsedLatitude > 90)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude",
      });
    }

    if (
      parsedLongitude !== null &&
      (!Number.isFinite(parsedLongitude) ||
        parsedLongitude < -180 ||
        parsedLongitude > 180)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid longitude",
      });
    }

    const operator = await prisma.user.findFirst({
      where: {
        id: req.user.id,
        role: "OPERATOR",
        plantId: req.user.plantId,
      },
      select: {
        id: true,
        plantId: true,
      },
    });

    if (!operator) {
      return res.status(404).json({
        success: false,
        message: "Operator or assigned plant not found",
      });
    }

    const tankerLog = await prisma.tankerLog.create({
      data: {
        tankerNumber: normalizedTankerNumber,
        agency: normalizedAgency,
        volume: parsedVolume,
        volumeUnit: "kL",
        receiptImageUrl: normalizedReceiptImageUrl || null,
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        loggedAt: parsedLoggedAt,
        plantId: operator.plantId,
        operatorId: operator.id,
      },
      include: tankerLogInclude,
    });

    return res.status(201).json({
      success: true,
      message: "Tanker trip logged successfully",
      tankerLog,
    });
  } catch (error) {
    console.error("Create tanker log error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to log tanker trip",
    });
  }
};

const getTankerLogs = async (req, res) => {
  try {
    const {
      search = "",
      page = "1",
      limit = "20",
    } = req.query;

    const pageNumber = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 20, 1),
      100
    );

    const normalizedSearch =
      typeof search === "string" ? search.trim() : "";

    const where = {
      operatorId: req.user.id,
      ...(req.user.plantId && {
        plantId: req.user.plantId,
      }),
      ...(normalizedSearch && {
        OR: [
          {
            tankerNumber: {
              contains: normalizedSearch,
              mode: "insensitive",
            },
          },
          {
            agency: {
              contains: normalizedSearch,
              mode: "insensitive",
            },
          },
        ],
      }),
    };

    const [tankerLogs, total] = await Promise.all([
      prisma.tankerLog.findMany({
        where,
        include: tankerLogInclude,
        orderBy: {
          loggedAt: "desc",
        },
        skip: (pageNumber - 1) * limitNumber,
        take: limitNumber,
      }),
      prisma.tankerLog.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      tankerLogs,
      summary: {
        totalTrips: total,
        receiptCount: tankerLogs.filter(
          (log) => Boolean(log.receiptImageUrl)
        ).length,
      },
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get tanker logs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tanker logs",
    });
  }
};

const getTankerLogById = async (req, res) => {
  try {
    const tankerLog = await prisma.tankerLog.findFirst({
      where: {
        id: req.params.id,
        operatorId: req.user.id,
        ...(req.user.plantId && {
          plantId: req.user.plantId,
        }),
      },
      include: tankerLogInclude,
    });

    if (!tankerLog) {
      return res.status(404).json({
        success: false,
        message: "Tanker log not found",
      });
    }

    return res.status(200).json({
      success: true,
      tankerLog,
    });
  } catch (error) {
    console.error("Get tanker log error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tanker log",
    });
  }
};

const uploadTankerReceipt = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Receipt image is required",
    });
  }

  const receiptImageUrl = `/api/operator/tanker-receipts/${req.file.filename}`;

  return res.status(201).json({
    success: true,
    message: "Receipt uploaded successfully",
    receiptImageUrl,
  });
};

const getTankerReceipt = async (req, res) => {
  const filename = path.basename(req.params.filename);

  if (
    filename !== req.params.filename ||
    !filename.startsWith(`${req.user.id}-`)
  ) {
    return res.status(404).json({
      success: false,
      message: "Receipt image not found",
    });
  }

  const receiptImageUrl = `/api/operator/tanker-receipts/${filename}`;
  const tankerLog = await prisma.tankerLog.findFirst({
    where: {
      operatorId: req.user.id,
      receiptImageUrl,
    },
    select: { id: true },
  });

  const filePath = path.join(uploadDirectory, filename);

  if (!tankerLog || !fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: "Receipt image not found",
    });
  }

  return res.sendFile(filePath);
};

const manualTestStatuses = ["GOOD", "WARNING", "CRITICAL"];

const manualTestParameterMap = {
  ph: "pH",
  bod: "BOD",
  cod: "COD",
  doValue: "DO",
  tss: "TSS",
  turbidity: "Turbidity",
  temperature: "Temperature",
};

const calculateParameterStatus = (value, threshold) => {
  if (value >= threshold.goodMin && value <= threshold.goodMax) return "GOOD";
  if (value >= threshold.warningMin && value <= threshold.warningMax) return "WARNING";
  return "CRITICAL";
};

const calculateOverallStatus = (statuses) => {
  if (statuses.includes("CRITICAL")) return "CRITICAL";
  if (statuses.includes("WARNING")) return "WARNING";
  return "GOOD";
};

const operatorManualTestInclude = {
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
  operator: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
};

const createOperatorManualTest = async (req, res) => {
  try {
    const {
      tankId,
      ph,
      bod,
      cod,
      doValue,
      tss,
      turbidity,
      temperature,
      status,
      testedAt,
      notes,
    } = req.body;

    if (!req.user.plantId) {
      return res.status(400).json({
        success: false,
        message: "Operator is not assigned to a plant",
      });
    }

    if (!tankId) {
      return res.status(400).json({
        success: false,
        message: "tankId is required",
      });
    }

    const inputValues = {
      ph,
      bod,
      cod,
      doValue,
      tss,
      turbidity,
      temperature,
    };

    const numericValues = {};

    for (const [field, value] of Object.entries(inputValues)) {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`,
        });
      }

      const parsedValue = Number(value);

      if (!Number.isFinite(parsedValue)) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a valid number`,
        });
      }

      if (parsedValue < 0) {
        return res.status(400).json({
          success: false,
          message: `${field} cannot be negative`,
        });
      }

      numericValues[field] = parsedValue;
    }

    if (numericValues.ph > 14) {
      return res.status(400).json({
        success: false,
        message: "pH must be between 0 and 14",
      });
    }

    const thresholds = await prisma.manualTestThreshold.findMany();
    const thresholdByParameter = new Map(
      thresholds.map((threshold) => [threshold.parameter, threshold])
    );

    const parameterStatuses = {};
    for (const [field, value] of Object.entries(numericValues)) {
      const parameter = manualTestParameterMap[field];
      const threshold = thresholdByParameter.get(parameter);
      if (!threshold) {
        return res.status(500).json({
          success: false,
          message: `Threshold configuration is missing for ${parameter}`,
        });
      }
      parameterStatuses[parameter] = calculateParameterStatus(value, threshold);
    }
    const calculatedStatus = calculateOverallStatus(Object.values(parameterStatuses));

    const tank = await prisma.tank.findFirst({
      where: {
        id: tankId,
        plantId: req.user.plantId,
      },
      select: {
        id: true,
      },
    });

    if (!tank) {
      return res.status(404).json({
        success: false,
        message: "Tank not found in the Operator's assigned plant",
      });
    }

    let parsedTestedAt = new Date();

    if (testedAt) {
      parsedTestedAt = new Date(testedAt);

      if (Number.isNaN(parsedTestedAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid testedAt date",
        });
      }
    }

    const manualTestResult =
      await prisma.manualTestResult.create({
        data: {
          ...numericValues,
          status: calculatedStatus,
          testedAt: parsedTestedAt,
          notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
          parameterStatuses,
          tankId,
          operatorId: req.user.id,
          engineerId: null,
        },
        include: operatorManualTestInclude,
      });

    return res.status(201).json({
      success: true,
      message: "Manual test result saved successfully",
      manualTestResult,
    });
  } catch (error) {
    console.error("Create Operator manual test error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save manual test result",
    });
  }
};

const getManualTestThresholds = async (_req, res) => {
  try {
    const thresholds = await prisma.manualTestThreshold.findMany({
      orderBy: { parameter: "asc" },
    });
    return res.status(200).json({ success: true, thresholds });
  } catch (error) {
    console.error("Get manual test thresholds error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch manual test thresholds" });
  }
};

const getOperatorManualTests = async (req, res) => {
  try {
    const { tankId, status } = req.query;

    if (
      status &&
      !manualTestStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid manual test status",
      });
    }

    if (!req.user.plantId) {
      return res.status(200).json({
        success: true,
        count: 0,
        manualTestResults: [],
      });
    }

    const manualTestResults =
      await prisma.manualTestResult.findMany({
        where: {
          operatorId: req.user.id,
          tank: {
            plantId: req.user.plantId,
          },
          ...(tankId && { tankId }),
          ...(status && { status }),
        },
        orderBy: {
          testedAt: "desc",
        },
        include: operatorManualTestInclude,
      });

    return res.status(200).json({
      success: true,
      count: manualTestResults.length,
      manualTestResults,
    });
  } catch (error) {
    console.error("Get Operator manual tests error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch manual test results",
    });
  }
};

const getOperatorManualTestById = async (req, res) => {
  try {
    if (!req.user.plantId) {
      return res.status(404).json({
        success: false,
        message: "Manual test result not found",
      });
    }

    const manualTestResult =
      await prisma.manualTestResult.findFirst({
        where: {
          id: req.params.id,
          operatorId: req.user.id,
          tank: {
            plantId: req.user.plantId,
          },
        },
        include: operatorManualTestInclude,
      });

    if (!manualTestResult) {
      return res.status(404).json({
        success: false,
        message: "Manual test result not found",
      });
    }

    return res.status(200).json({
      success: true,
      manualTestResult,
    });
  } catch (error) {
    console.error("Get Operator manual test error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch manual test result",
    });
  }
};

const updateOperatorManualTestNotes = async (req, res) => {
  try {
    const existing = await prisma.manualTestResult.findFirst({
      where: { id: req.params.id, operatorId: req.user.id },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Manual test result not found" });
    }
    const notes = typeof req.body.notes === "string" && req.body.notes.trim()
      ? req.body.notes.trim()
      : null;
    const manualTestResult = await prisma.manualTestResult.update({
      where: { id: existing.id },
      data: { notes },
      include: operatorManualTestInclude,
    });
    return res.status(200).json({
      success: true,
      message: "Notes saved successfully",
      manualTestResult,
    });
  } catch (error) {
    console.error("Update Operator manual test notes error:", error);
    return res.status(500).json({ success: false, message: "Failed to save notes" });
  }
};


module.exports = { getDashboard, getProfile, getPlant, getAlerts, resolveAlert, getTasks, getTaskById, startTask, 
  completeTask,
createTankerLog,
getTankerLogs,
getTankerLogById,
uploadTankerReceipt,
uploadTaskEvidence,
getTaskEvidence,
createOperatorManualTest,
getOperatorManualTests,
getOperatorManualTestById,
updateOperatorManualTestNotes,
getManualTestThresholds,
getTankerReceipt, };
