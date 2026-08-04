const prisma = require("../../config/db");

const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const allowedStatuses = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

// CREATE TICKET
const createTicket = async (req, res) => {
  try {
    const {
      title,
      description,
      priority, 
      plantId,
      alertId,
      assignedEngineerId,
    } = req.body;

    if (!title || !plantId) {
      return res.status(400).json({
        success: false,
        message: "Title and plantId are required",
      });
    }

    if (priority && !allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket priority",
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

    if (alertId) {
      const alert = await prisma.alert.findUnique({
        where: { id: alertId },
      });

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: "Alert not found",
        });
      }

      if (alert.plantId !== plantId) {
        return res.status(400).json({
          success: false,
          message: "Alert does not belong to the selected plant",
        });
      }
    }

    let engineer = null;

    if (assignedEngineerId) {
      engineer = await prisma.user.findUnique({
        where: { id: assignedEngineerId },
      });

      if (!engineer) {
        return res.status(404).json({
          success: false,
          message: "Engineer not found",
        });
      }

      if (engineer.role !== "ENGINEER") {
        return res.status(400).json({
          success: false,
          message: "Selected user is not an engineer",
        });
      }

      if (engineer.status === "INACTIVE") {
        return res.status(400).json({
          success: false,
          message: "Cannot assign an inactive engineer",
        });
      }
    }

    const ticket = await prisma.ticket.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || "MEDIUM",
        status: assignedEngineerId ? "ASSIGNED" : "OPEN",
        plantId,
        alertId: alertId || null,
        assignedEngineerId: assignedEngineerId || null,
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
    });

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      ticket,
    });
  } catch (error) {
    console.error("Create ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create ticket",
    });
  }
};

// GET ALL TICKETS
const getTickets = async (req, res) => {
  try {
    const {
      search = "",
      plantId,
      alertId,
      assignedEngineerId,
      status,
      priority,
      page = "1",
      limit = "20",
    } = req.query;

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

    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      ...(plantId && { plantId }),
      ...(alertId && { alertId }),
      ...(assignedEngineerId && { assignedEngineerId }),
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
          {
            assignedEngineer: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        ],
      }),
    };

    const [tickets, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        skip,
        take: limitNumber,
        orderBy: {
          createdAt: "desc",
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
          },
        },
      },
    },
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
      }),

      prisma.ticket.count({
        where,
      }),
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
    console.error("Get tickets error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tickets",
    });
  }
};

// GET TICKET BY ID
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
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
        alert: {
          include: {
            sensor: {
              include: {
                tank: true,
              },
            },
          },
        },
        assignedEngineer: {
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
    console.error("Get ticket by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ticket",
    });
  }
};

// UPDATE TICKET DETAILS
const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      priority,
    } = req.body;

    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!existingTicket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (priority && !allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket priority",
      });
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(title !== undefined && {
          title: title.trim(),
        }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
        ...(priority !== undefined && {
          priority,
        }),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      ticket,
    });
  } catch (error) {
    console.error("Update ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update ticket",
    });
  }
};

// ASSIGN ENGINEER
const assignEngineer = async (req, res) => {
  try {
    const { id } = req.params;
    const { engineerId } = req.body;

    if (!engineerId) {
      return res.status(400).json({
        success: false,
        message: "engineerId is required",
      });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (["RESOLVED", "CLOSED"].includes(ticket.status)) {
      return res.status(409).json({
        success: false,
        message: "Resolved or closed ticket cannot be assigned",
      });
    }

    const engineer = await prisma.user.findUnique({
      where: { id: engineerId },
    });

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: "Engineer not found",
      });
    }

    if (engineer.role !== "ENGINEER") {
      return res.status(400).json({
        success: false,
        message: "Selected user is not an engineer",
      });
    }

    if (engineer.status === "INACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Cannot assign an inactive engineer",
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        assignedEngineerId: engineerId,
        status: "ASSIGNED",
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
    });

    return res.status(200).json({
      success: true,
      message: "Engineer assigned successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("Assign engineer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign engineer",
    });
  }
};

// START TICKET
const startTicket = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (ticket.status !== "ASSIGNED") {
      return res.status(409).json({
        success: false,
        message: "Only an assigned ticket can be started",
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Ticket started successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("Start ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to start ticket",
    });
  }
};

// RESOLVE TICKET
const resolveTicket = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (ticket.status !== "IN_PROGRESS") {
      return res.status(409).json({
        success: false,
        message: "Only an in-progress ticket can be resolved",
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Ticket resolved successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("Resolve ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to resolve ticket",
    });
  }
};

// CLOSE TICKET
const closeTicket = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (ticket.status !== "RESOLVED") {
      return res.status(409).json({
        success: false,
        message: "Only a resolved ticket can be closed",
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        status: "CLOSED",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Ticket closed successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("Close ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to close ticket",
    });
  }
};

// DELETE TICKET
const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    await prisma.ticket.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Ticket deleted successfully",
    });
  } catch (error) {
    console.error("Delete ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete ticket",
    });
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  assignEngineer,
  startTicket,
  resolveTicket,
  closeTicket,
  deleteTicket,
};