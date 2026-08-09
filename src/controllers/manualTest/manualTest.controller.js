const prisma = require("../../config/db");

const allowedStatuses = [
  "GOOD",
  "WARNING",
  "CRITICAL",
];

const resultInclude = {
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
  engineer: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
};

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

const createManualTestResult = async (req, res) => {
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
    } = req.body;

    const requiredValues = {
      ph,
      bod,
      cod,
      doValue,
      tss,
      turbidity,
      temperature,
    };

    if (!tankId || !status) {
      return res.status(400).json({
        success: false,
        message: "tankId and status are required",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid manual test status",
      });
    }

    const numericValues = {};

    for (const [field, value] of Object.entries(requiredValues)) {
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

      numericValues[field] = parsedValue;
    }

    const plantId = await getEngineerPlantId(req.user.id);

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
          status,
          testedAt: parsedTestedAt,
          tankId,
          engineerId: req.user.id,
        },
        include: resultInclude,
      });

    return res.status(201).json({
      success: true,
      message: "Manual test result saved successfully",
      manualTestResult,
    });
  } catch (error) {
    console.error("Create Manual Test Result error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save manual test result",
    });
  }
};

const getManualTestResults = async (req, res) => {
  try {
    const { tankId, status } = req.query;

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid manual test status",
      });
    }

    const plantId = await getEngineerPlantId(req.user.id);

    if (!plantId) {
      return res.status(200).json({
        success: true,
        count: 0,
        manualTestResults: [],
      });
    }

    const manualTestResults =
      await prisma.manualTestResult.findMany({
        where: {
          engineerId: req.user.id,
          tank: {
            plantId,
          },
          ...(tankId && { tankId }),
          ...(status && { status }),
        },
        orderBy: {
          testedAt: "desc",
        },
        include: resultInclude,
      });

    return res.status(200).json({
      success: true,
      count: manualTestResults.length,
      manualTestResults,
    });
  } catch (error) {
    console.error("Get Manual Test Results error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch manual test results",
    });
  }
};

const getManualTestResultById = async (req, res) => {
  try {
    const plantId = await getEngineerPlantId(req.user.id);

    if (!plantId) {
  return res.status(400).json({
    success: false,
    message: "Engineer is not assigned to a plant",
  });
}

    const manualTestResult =
      await prisma.manualTestResult.findFirst({
        where: {
          id: req.params.id,
          engineerId: req.user.id,
          tank: {
  plantId,
},
        },
        include: resultInclude,
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
    console.error("Get Manual Test Result error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch manual test result",
    });
  }
};

module.exports = {
  createManualTestResult,
  getManualTestResults,
  getManualTestResultById,
};