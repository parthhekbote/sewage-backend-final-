const prisma = require("../../config/db");

const allowedConditions = [
  "FIXED",
  "NEEDS_MONITORING",
  "FURTHER_REPAIR_REQUIRED",
];

const workReportInclude = {
  ticket: {
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
          severity: true,
          status: true,
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

const createWorkReport = async (req, res) => {
  try {
    const {
      ticketId,
      description,
      actionsTaken,
      partsReplaced,
      equipmentCondition,
      imageUrls = [],
    } = req.body;

    if (
      !ticketId ||
      !description ||
      !actionsTaken ||
      !equipmentCondition
    ) {
      return res.status(400).json({
        success: false,
        message:
          "ticketId, description, actionsTaken and equipmentCondition are required",
      });
    }

    if (!allowedConditions.includes(equipmentCondition)) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment condition",
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

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        assignedEngineerId: req.user.id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found or not assigned to this engineer",
      });
    }

    if (ticket.status === "OPEN" || ticket.status === "CLOSED") {
      return res.status(409).json({
        success: false,
        message:
          "A work report cannot be submitted for an open or closed ticket",
      });
    }

    const existingReport = await prisma.workReport.findUnique({
      where: {
        ticketId_engineerId: {
          ticketId,
          engineerId: req.user.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingReport) {
      return res.status(409).json({
        success: false,
        message: "A work report already exists for this ticket",
      });
    }

    const workReport = await prisma.workReport.create({
      data: {
        description: description.trim(),
        actionsTaken: actionsTaken.trim(),
        partsReplaced: partsReplaced?.trim() || null,
        equipmentCondition,
        imageUrls,
        ticketId,
        engineerId: req.user.id,
      },
      include: workReportInclude,
    });

    return res.status(201).json({
      success: true,
      message: "Work report submitted successfully",
      workReport,
    });
  } catch (error) {
    console.error("Create Work Report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit work report",
    });
  }
};

const getWorkReports = async (req, res) => {
  try {
    const { equipmentCondition, ticketId } = req.query;

    if (
      equipmentCondition &&
      !allowedConditions.includes(equipmentCondition)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment condition",
      });
    }

    const workReports = await prisma.workReport.findMany({
      where: {
        engineerId: req.user.id,
        ...(equipmentCondition && { equipmentCondition }),
        ...(ticketId && { ticketId }),
      },
      orderBy: {
        createdAt: "desc",
      },
      include: workReportInclude,
    });

    return res.status(200).json({
      success: true,
      count: workReports.length,
      workReports,
    });
  } catch (error) {
    console.error("Get Work Reports error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch work reports",
    });
  }
};

const getWorkReportById = async (req, res) => {
  try {
    const workReport = await prisma.workReport.findFirst({
      where: {
        id: req.params.id,
        engineerId: req.user.id,
      },
      include: workReportInclude,
    });

    if (!workReport) {
      return res.status(404).json({
        success: false,
        message: "Work report not found",
      });
    }

    return res.status(200).json({
      success: true,
      workReport,
    });
  } catch (error) {
    console.error("Get Work Report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch work report",
    });
  }
};

const updateWorkReport = async (req, res) => {
  try {
    const {
      description,
      actionsTaken,
      partsReplaced,
      equipmentCondition,
      imageUrls,
    } = req.body;

    if (
      equipmentCondition !== undefined &&
      !allowedConditions.includes(equipmentCondition)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid equipment condition",
      });
    }

    if (
      imageUrls !== undefined &&
      (!Array.isArray(imageUrls) ||
        !imageUrls.every((url) => typeof url === "string"))
    ) {
      return res.status(400).json({
        success: false,
        message: "imageUrls must be an array of strings",
      });
    }

    const existingReport = await prisma.workReport.findFirst({
      where: {
        id: req.params.id,
        engineerId: req.user.id,
      },
      include: {
        ticket: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: "Work report not found",
      });
    }

    if (existingReport.ticket.status === "CLOSED") {
      return res.status(409).json({
        success: false,
        message: "A report for a closed ticket cannot be edited",
      });
    }

    const workReport = await prisma.workReport.update({
      where: {
        id: existingReport.id,
      },
      data: {
        ...(description !== undefined && {
          description: description.trim(),
        }),
        ...(actionsTaken !== undefined && {
          actionsTaken: actionsTaken.trim(),
        }),
        ...(partsReplaced !== undefined && {
          partsReplaced: partsReplaced?.trim() || null,
        }),
        ...(equipmentCondition !== undefined && {
          equipmentCondition,
        }),
        ...(imageUrls !== undefined && {
          imageUrls,
        }),
      },
      include: workReportInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Work report updated successfully",
      workReport,
    });
  } catch (error) {
    console.error("Update Work Report error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update work report",
    });
  }
};

module.exports = {
  createWorkReport,
  getWorkReports,
  getWorkReportById,
  updateWorkReport,
};