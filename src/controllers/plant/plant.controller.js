const prisma = require("../../config/db");
const { randomUUID } = require("crypto");

const updatePlantMetrics = async (req, res) => {
  try {
    const plant = await prisma.plant.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!plant) {
      return res.status(404).json({ success: false, message: "Plant not found" });
    }

    const floatFields = ["treatedWater", "flowRate", "energyConsumption"];
    const integerFields = ["complianceScore", "violations", "sensorsOnline", "sensorsTotal"];
    const data = {};

    for (const field of floatFields) {
      if (req.body[field] !== undefined) {
        const value = Number(req.body[field]);
        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({ success: false, message: `${field} must be a non-negative number` });
        }
        data[field] = value;
      }
    }

    for (const field of integerFields) {
      if (req.body[field] !== undefined) {
        const value = Number(req.body[field]);
        if (!Number.isInteger(value) || value < 0) {
          return res.status(400).json({ success: false, message: `${field} must be a non-negative integer` });
        }
        data[field] = value;
      }
    }

    if (data.complianceScore !== undefined && data.complianceScore > 100) {
      return res.status(400).json({ success: false, message: "complianceScore cannot exceed 100" });
    }
    const online = data.sensorsOnline;
    const total = data.sensorsTotal;
    if (online !== undefined && total !== undefined && online > total) {
      return res.status(400).json({ success: false, message: "sensorsOnline cannot exceed sensorsTotal" });
    }

    for (const field of ["lastDesludging", "nextDesludging"]) {
      if (req.body[field] !== undefined) {
        if (req.body[field] === null || req.body[field] === "") {
          data[field] = null;
        } else {
          const value = new Date(req.body[field]);
          if (Number.isNaN(value.getTime())) {
            return res.status(400).json({ success: false, message: `${field} must be a valid date` });
          }
          data[field] = value;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: "At least one metric field is required" });
    }

    const existing = await prisma.plantMetrics.findUnique({
      where: { plantId: plant.id },
      select: { sensorsOnline: true, sensorsTotal: true },
    });
    const finalOnline = data.sensorsOnline ?? existing?.sensorsOnline;
    const finalTotal = data.sensorsTotal ?? existing?.sensorsTotal;
    if (finalOnline != null && finalTotal != null && finalOnline > finalTotal) {
      return res.status(400).json({ success: false, message: "sensorsOnline cannot exceed sensorsTotal" });
    }

    const metrics = await prisma.plantMetrics.upsert({
      where: { plantId: plant.id },
      update: data,
      create: { id: randomUUID(), plantId: plant.id, ...data },
    });
    return res.status(200).json({
      success: true,
      message: "Plant metrics updated successfully",
      metrics,
    });
  } catch (error) {
    console.error("Update plant metrics error:", error);
    return res.status(500).json({ success: false, message: "Failed to update plant metrics" });
  }
};

// CREATE PLANT
const createPlant = async (req, res) => {
  try {
    const {
      name,
      code,
      address,
      city,
      state,
      pincode,
      capacity,
      technology,
      commissioningDate,
      buildingId,
    } = req.body;

    if (
      !name ||
      !address ||
      !city ||
      !state ||
      !pincode ||
      capacity === undefined ||
      !technology ||
      !buildingId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, address, city, state, pincode, capacity, technology and buildingId are required",
      });
    }

    const parsedCapacity = Number(capacity);

    if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be a positive number",
      });
    }

    const building = await prisma.building.findUnique({
      where: {
        id: buildingId,
      },
    });

    if (!building) {
      return res.status(404).json({
        success: false,
        message: "Building not found",
      });
    }

    const duplicateConditions = [
  {
    buildingId,
    name: name.trim(),
  },
];

if (code?.trim()) {
  duplicateConditions.push({
    code: code.trim(),
  });
}

const duplicatePlant = await prisma.plant.findFirst({
  where: {
    OR: duplicateConditions,
  },
});

    if (duplicatePlant) {
      return res.status(409).json({
        success: false,
        message:
          "A plant with this name in the building or this code already exists",
      });
    }

    let parsedCommissioningDate = null;

    if (commissioningDate) {
      parsedCommissioningDate = new Date(commissioningDate);

      if (Number.isNaN(parsedCommissioningDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid commissioning date",
        });
      }
    }

    const plant = await prisma.plant.create({
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        capacity: parsedCapacity,
        technology: technology.trim(),
        commissioningDate: parsedCommissioningDate,
        buildingId,
      },
      include: {
        metrics: true,
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
    });

    return res.status(201).json({
      success: true,
      message: "Plant created successfully",
      plant,
    });
  } catch (error) {
    console.error("Create plant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create plant",
    });
  }
};

// GET ALL PLANTS
const getPlants = async (req, res) => {
  try {
    const {
      search = "",
      buildingId,
      organizationId,
      technology,
      city,
      page = "1",
      limit = "10",
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      ...(buildingId && {
        buildingId,
      }),
      ...(organizationId && {
        building: {
          organizationId,
        },
      }),
      ...(technology && {
        technology: {
          equals: technology,
          mode: "insensitive",
        },
      }),
      ...(city && {
        city: {
          equals: city,
          mode: "insensitive",
        },
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
            code: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            address: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            city: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            building: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
          {
            building: {
              organization: {
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

    const [plants, total] = await prisma.$transaction([
      prisma.plant.findMany({
        where,
        skip,
        take: limitNumber,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          metrics: true,
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
          _count: {
            select: {
              tanks: true,
              alerts: true,
              tickets: true,
              users: true,
            },
          },
        },
      }),

      prisma.plant.count({
        where,
      }),
    ]);

    return res.status(200).json({
      success: true,
      plants,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get plants error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plants",
    });
  }
};

// GET PLANT BY ID
const getPlantById = async (req, res) => {
  try {
    const { id } = req.params;

    const plant = await prisma.plant.findUnique({
      where: {
        id,
      },
      include: {
        metrics: true,
        building: {
          include: {
            organization: true,
          },
        },
        tanks: {
          include: {
            sensors: {
              include: {
                readings: {
                  orderBy: { recordedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
        alerts: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            tickets: {
              include: {
                assignedEngineer: {
                  select: {
                    id: true,
                    name: true,
                    phone: true,
                    email: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
        tickets: {
          orderBy: {
            createdAt: "desc",
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
        },
        users: {
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

    if (!plant) {
      return res.status(404).json({
        success: false,
        message: "Plant not found",
      });
    }

    return res.status(200).json({
      success: true,
      plant,
    });
  } catch (error) {
    console.error("Get plant by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plant",
    });
  }
};

// UPDATE PLANT
const updatePlant = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      code,
      address,
      city,
      state,
      pincode,
      capacity,
      technology,
      commissioningDate,
      buildingId,
    } = req.body;

    const existingPlant = await prisma.plant.findUnique({
      where: {
        id,
      },
    });

    if (!existingPlant) {
      return res.status(404).json({
        success: false,
        message: "Plant not found",
      });
    }

    if (buildingId) {
      const building = await prisma.building.findUnique({
        where: {
          id: buildingId,
        },
      });

      if (!building) {
        return res.status(404).json({
          success: false,
          message: "Building not found",
        });
      }
    }

    const finalBuildingId =
      buildingId || existingPlant.buildingId;

    if (name || code !== undefined) {
      const duplicateConditions = [];

      if (name) {
        duplicateConditions.push({
  buildingId: finalBuildingId,
  name: name.trim(),
});
      }

      if (code?.trim()) {
        duplicateConditions.push({
          code: code.trim(),
        });
      }

      if (duplicateConditions.length > 0) {
        const duplicatePlant = await prisma.plant.findFirst({
          where: {
            id: {
              not: id,
            },
            OR: duplicateConditions,
          },
        });

        if (duplicatePlant) {
          return res.status(409).json({
            success: false,
            message:
              "Another plant already uses this name in the building or this code",
          });
        }
      }
    }

    let parsedCapacity;

    if (capacity !== undefined) {
      parsedCapacity = Number(capacity);

      if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Capacity must be a positive number",
        });
      }
    }

    let parsedCommissioningDate;

    if (commissioningDate !== undefined) {
      if (!commissioningDate) {
        parsedCommissioningDate = null;
      } else {
        parsedCommissioningDate = new Date(commissioningDate);

        if (Number.isNaN(parsedCommissioningDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid commissioning date",
          });
        }
      }
    }

    const plant = await prisma.plant.update({
      where: {
        id,
      },
      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),
        ...(code !== undefined && {
          code: code?.trim() || null,
        }),
        ...(address !== undefined && {
          address: address.trim(),
        }),
        ...(city !== undefined && {
          city: city.trim(),
        }),
        ...(state !== undefined && {
          state: state.trim(),
        }),
        ...(pincode !== undefined && {
          pincode: pincode.trim(),
        }),
        ...(capacity !== undefined && {
          capacity: parsedCapacity,
        }),
        ...(technology !== undefined && {
          technology: technology.trim(),
        }),
        ...(commissioningDate !== undefined && {
          commissioningDate: parsedCommissioningDate,
        }),
        ...(buildingId !== undefined && {
          buildingId,
        }),
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
      },
    });

    return res.status(200).json({
      success: true,
      message: "Plant updated successfully",
      plant,
    });
  } catch (error) {
    console.error("Update plant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update plant",
    });
  }
};

// DELETE PLANT
const deletePlant = async (req, res) => {
  try {
    const { id } = req.params;

    const plant = await prisma.plant.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            tanks: true,
            alerts: true,
            tickets: true,
            users: true,
          },
        },
      },
    });

    if (!plant) {
      return res.status(404).json({
        success: false,
        message: "Plant not found",
      });
    }

    const hasLinkedRecords =
      plant._count.tanks > 0 ||
      plant._count.alerts > 0 ||
      plant._count.tickets > 0 ||
      plant._count.users > 0;

    if (hasLinkedRecords) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete plant because it has linked tanks, alerts, tickets or users",
      });
    }

    await prisma.plant.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Plant deleted successfully",
    });
  } catch (error) {
    console.error("Delete plant error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete plant",
    });
  }
};

const getPlantAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const period = (req.query.period || "week").toLowerCase();
    const periodDays = { day: 1, week: 7, month: 30, year: 365 };

    if (!periodDays[period]) {
      return res.status(400).json({
        success: false,
        message: "Invalid period. Use day, week, month, or year",
      });
    }

    const plant = await prisma.plant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!plant) {
      return res.status(404).json({ success: false, message: "Plant not found" });
    }

    const from = new Date();
    from.setDate(from.getDate() - periodDays[period]);

    const readings = await prisma.sensorReading.findMany({
      where: {
        recordedAt: { gte: from },
        sensor: {
          tank: { plantId: id },
          type: { in: ["PH", "COD", "DISSOLVED_OXYGEN"] },
        },
      },
      orderBy: { recordedAt: "asc" },
      select: {
        value: true,
        recordedAt: true,
        sensor: {
          select: {
            type: true,
            tank: { select: { id: true, name: true } },
          },
        },
      },
    });

    const analytics = { do: [], ph: [], cod: [] };
    const grouped = { do: new Map(), ph: new Map(), cod: new Map() };

    const getMetricKey = (type) => {
      if (type === "PH") return "ph";
      if (type === "COD") return "cod";
      return "do";
    };

    const getBucket = (date) => {
      const iso = date.toISOString();
      if (period === "day") return iso.slice(0, 13) + ":00:00.000Z";
      if (period === "year") return iso.slice(0, 7) + "-01T00:00:00.000Z";
      return iso.slice(0, 10) + "T00:00:00.000Z";
    };

    for (const reading of readings) {
      const metricKey = getMetricKey(reading.sensor.type);
      analytics[metricKey].push(reading.value);

      const bucket = getBucket(reading.recordedAt);
      const current = grouped[metricKey].get(bucket) || { total: 0, count: 0 };
      current.total += reading.value;
      current.count += 1;
      grouped[metricKey].set(bucket, current);
    }

    const series = Object.fromEntries(
      Object.entries(grouped).map(([metric, buckets]) => [
        metric,
        [...buckets.entries()].map(([recordedAt, aggregate]) => ({
          recordedAt,
          value: Number((aggregate.total / aggregate.count).toFixed(2)),
          readingCount: aggregate.count,
        })),
      ])
    );

    return res.status(200).json({ success: true, period, analytics, series });
  } catch (error) {
    console.error("Get Admin plant analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch plant analytics",
    });
  }
};

module.exports = {
  createPlant,
  getPlants,
  getPlantById,
  getPlantAnalytics,
  updatePlant,
  deletePlant,
  updatePlantMetrics,
};
