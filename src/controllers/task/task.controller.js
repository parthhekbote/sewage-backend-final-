const prisma = require("../../config/db");

const allowedStatuses = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
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

const taskInclude = {
  plant: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  operator: {
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
    },
  },
};

const createTask = async (req, res) => {
  try {
    const { title, description, dueAt, operatorId } = req.body;

    if (!title || !operatorId) {
      return res.status(400).json({
        success: false,
        message: "Title and operatorId are required",
      });
    }

    const plantId = await getEngineerPlantId(req.user.id);

    if (!plantId) {
      return res.status(400).json({
        success: false,
        message: "Engineer is not assigned to a plant",
      });
    }

    const operator = await prisma.user.findFirst({
      where: {
        id: operatorId,
        role: "OPERATOR",
        plantId,
        status: {
          not: "INACTIVE",
        },
      },
      select: {
        id: true,
      },
    });

    if (!operator) {
      return res.status(404).json({
        success: false,
        message: "Operator not found in the Engineer's assigned plant",
      });
    }

    let parsedDueAt = null;

    if (dueAt) {
      parsedDueAt = new Date(dueAt);

      if (Number.isNaN(parsedDueAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid dueAt date",
        });
      }
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        dueAt: parsedDueAt,
        plantId,
        operatorId,
      },
      include: taskInclude,
    });

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error("Create Task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create task",
    });
  }
};

const getTasks = async (req, res) => {
  try {
    const { search = "", status, operatorId } = req.query;

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    const plantId = await getEngineerPlantId(req.user.id);

    if (!plantId) {
      return res.status(200).json({
        success: true,
        count: 0,
        tasks: [],
      });
    }

    const tasks = await prisma.task.findMany({
      where: {
        plantId,
        ...(status && { status }),
        ...(operatorId && { operatorId }),
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
              operator: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          ],
        }),
      },
      orderBy: [
        {
          dueAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
      include: taskInclude,
    });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error("Get Tasks error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
    });
  }
};

const getTaskById = async (req, res) => {
  try {
    const plantId = await getEngineerPlantId(req.user.id);

    if (!plantId) {
  return res.status(400).json({
    success: false,
    message: "Engineer is not assigned to a plant",
  });
}

    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        plantId,
      },
      include: taskInclude,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    console.error("Get Task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch task",
    });
  }
};

const updateTask = async (req, res) => {
  try {
    const { title, description, dueAt, operatorId } = req.body;
    const plantId = await getEngineerPlantId(req.user.id);

    if (!plantId) {
  return res.status(400).json({
    success: false,
    message: "Engineer is not assigned to a plant",
  });
}

    const existingTask = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        plantId,
      },
    });

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (existingTask.status === "COMPLETED") {
      return res.status(409).json({
        success: false,
        message: "A completed task cannot be edited",
      });
    }

    if (operatorId !== undefined) {
      const operator = await prisma.user.findFirst({
        where: {
          id: operatorId,
          role: "OPERATOR",
          plantId,
          status: {
            not: "INACTIVE",
          },
        },
      });

      if (!operator) {
        return res.status(404).json({
          success: false,
          message: "Operator not found in the Engineer's assigned plant",
        });
      }
    }

    let parsedDueAt;

    if (dueAt !== undefined) {
      if (dueAt === null || dueAt === "") {
        parsedDueAt = null;
      } else {
        parsedDueAt = new Date(dueAt);

        if (Number.isNaN(parsedDueAt.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid dueAt date",
          });
        }
      }
    }

    const task = await prisma.task.update({
      where: {
        id: existingTask.id,
      },
      data: {
        ...(title !== undefined && {
          title: title.trim(),
        }),
        ...(description !== undefined && {
          description: description?.trim() || null,
        }),
        ...(dueAt !== undefined && {
          dueAt: parsedDueAt,
        }),
        ...(operatorId !== undefined && {
          operatorId,
        }),
      },
      include: taskInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("Update Task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update task",
    });
  }
};

const startTask = async (req, res) => {
  try {
    const plantId = await getEngineerPlantId(req.user.id);

    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        plantId,
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: "Only a pending task can be started",
      });
    }

    const updatedTask = await prisma.task.update({
      where: {
        id: task.id,
      },
      data: {
        status: "IN_PROGRESS",
      },
      include: taskInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Task started successfully",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Start Task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to start task",
    });
  }
};

const completeTask = async (req, res) => {
  try {
    const plantId = await getEngineerPlantId(req.user.id);
    if (!plantId) {
  return res.status(400).json({
    success: false,
    message: "Engineer is not assigned to a plant",
  });
}


    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        plantId,
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.status !== "IN_PROGRESS") {
      return res.status(409).json({
        success: false,
        message: "Only an in-progress task can be completed",
      });
    }

    const updatedTask = await prisma.task.update({
      where: {
        id: task.id,
      },
      data: {
        status: "COMPLETED",
      },
      include: taskInclude,
    });

    return res.status(200).json({
      success: true,
      message: "Task completed successfully",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Complete Task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to complete task",
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  startTask,
  completeTask,
};