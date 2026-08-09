const prisma = require("../../config/db");

const allowedConditions = [
  "HEALTHY",
  "NEEDS_ATTENTION",
  "CRITICAL",
];

const getEngineerPlantId = async (engineerId) => {
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

const reportInclude = {
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
  engineer: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
};

const createVisitReport = async (req, res) => {
  try {
    const {
      observation,
      condition,
      imageUrls = [],
      visitedAt,
    } = req.body;

    if (!observation || !condition) {
      return res.status(400).json({
        success: false,
        message: "Observation and condition are required",
      });
    }

    if (!allowedConditions.includes(condition)) {
      return res.status(400).json({
        success: false,
        message: "Invalid visit condition",
      });
    }

    if (
      !Array.isArray(imageUrls) ||
      !imageUrls.every((url) => typeof url === "string")
    ) {
      return res.status(400).json({
        success: false,
        message: "imageUrls must be an array of strings",
      });
    }

    const plantId = await getEngineerPlantId(req.user.id);

    if (!plantId) {
      return res.status(400).json({
        success: false,
        message: "Engineer is not assigned to a plant",
      });
    }

    let parsedVisitedAt = new Date();

    if (visitedAt) {
      parsedVisitedAt = new Date(visitedAt);

      if (Number.isNaN(parsedVisitedAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid visitedAt date",
        });
      }
    }

    const visitReport = await prisma.visitReport.create({
      data: {
        observation: observation.trim(),
        condition,
        imageUrls,
        visitedAt: parsedVisitedAt,
        plantId,
        engineerId: req.user.id,
      },
      include: reportInclude,
    });

    return res.status(201).json({
      success: true,
      message: "Visit report submitted successfully",
      visitReport,
    });
  } catch (error) {
    console.error("Create Visit Report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit visit report",
    });
  }
};

const getVisitReports = async (req, res) => {
  try {
    const { condition } = req.query;

    if (condition && !allowedConditions.includes(condition)) {
      return res.status(400).json({
        success: false,
        message: "Invalid visit condition",
      });
    }

    const plantId = await getEngineerPlantId(req.user.id);

    if (!plantId) {
      return res.status(200).json({
        success: true,
        count: 0,
        visitReports: [],
      });
    }

    const visitReports = await prisma.visitReport.findMany({
      where: {
        plantId,
        engineerId: req.user.id,
        ...(condition && { condition }),
      },
      orderBy: {
        visitedAt: "desc",
      },
      include: reportInclude,
    });

    return res.status(200).json({
      success: true,
      count: visitReports.length,
      visitReports,
    });
  } catch (error) {
    console.error("Get Visit Reports error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch visit reports",
    });
  }
};

const getVisitReportById = async (req, res) => {
  try {
    const plantId = await getEngineerPlantId(req.user.id);

    const visitReport = await prisma.visitReport.findFirst({
      where: {
        id: req.params.id,
        engineerId: req.user.id,
        plantId: plantId || undefined,
      },
      include: reportInclude,
    });

    if (!visitReport) {
      return res.status(404).json({
        success: false,
        message: "Visit report not found",
      });
    }

    return res.status(200).json({
      success: true,
      visitReport,
    });
  } catch (error) {
    console.error("Get Visit Report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch visit report",
    });
  }
};

module.exports = {
  createVisitReport,
  getVisitReports,
  getVisitReportById,
};