// PURPOSE:
// This file implements organization CRUD controller operations.
// It manages organization records through the Prisma database client.
const prisma = require("../../config/db");

// CREATE ORGANIZATION
const createOrganization = async (req, res) => {
  try {
    const {
      name,
      address,
      contactPersonName,
      phone,
      email,
      organizationType,
      gstNumber,
      description,
    } = req.body;

    if (
      !name ||
      !address ||
      !contactPersonName ||
      !phone ||
      !email ||
      !organizationType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, address, contact person, phone, email and organization type are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingOrganization =
      await prisma.organization.findFirst({
        where: {
          OR: [
            { email: normalizedEmail },
            { phone: phone.trim() },
            ...(gstNumber
              ? [{ gstNumber: gstNumber.trim() }]
              : []),
          ],
        },
      });

    if (existingOrganization) {
      return res.status(409).json({
        success: false,
        message:
          "Organization with this email, phone or GST number already exists",
      });
    }

    const organization =
      await prisma.organization.create({
        data: {
          name: name.trim(),
          address: address.trim(),
          contactPersonName: contactPersonName.trim(),
          phone: phone.trim(),
          email: normalizedEmail,
          organizationType: organizationType.trim(),
          gstNumber: gstNumber?.trim() || null,
          description: description?.trim() || null,
        },
      });

    return res.status(201).json({
      success: true,
      message: "Organization created successfully",
      organization,
    });
  } catch (error) {
    console.error("Create organization error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create organization",
    });
  }
};

// GET ALL ORGANIZATIONS
const getOrganizations = async (req, res) => {
  try {
    const {
      search = "",
      page = "1",
      limit = "10",
    } = req.query;

    const pageNumber = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    const where = search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              phone: {
                contains: search,
              },
            },
            {
              contactPersonName: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {};

    const [organizations, total] =
      await prisma.$transaction([
        prisma.organization.findMany({
          where,
          skip,
          take: limitNumber,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            buildings: {
              orderBy: {
                createdAt: "asc",
              },
              include: {
                plants: {
                  include: {
                    metrics: true,
                    _count: {
                      select: {
                        alerts: true,
                        tickets: true,
                        tanks: true,
                        users: true,
                      },
                    },
                  },
                },
              },
            },
            _count: {
              select: {
                users: true,
                buildings: true,
              },
            },
          },
        }),

        prisma.organization.count({
          where,
        }),
      ]);

    return res.status(200).json({
      success: true,
      organizations,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get organizations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch organizations",
    });
  }
};

// GET ORGANIZATION BY ID
const getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;

    const organization =
      await prisma.organization.findUnique({
        where: {
          id,
        },
        include: {
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
          buildings: {
            include: {
              plants: true,
            },
          },
        },
      });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    return res.status(200).json({
      success: true,
      organization,
    });
  } catch (error) {
    console.error(
      "Get organization by ID error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch organization",
    });
  }
};

// UPDATE ORGANIZATION
const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      address,
      contactPersonName,
      phone,
      email,
      organizationType,
      gstNumber,
      description,
    } = req.body;

    const existingOrganization =
      await prisma.organization.findUnique({
        where: {
          id,
        },
      });

    if (!existingOrganization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    const duplicateOrganization =
      await prisma.organization.findFirst({
        where: {
          id: {
            not: id,
          },
          OR: [
            ...(email
              ? [
                  {
                    email: email.trim().toLowerCase(),
                  },
                ]
              : []),
            ...(phone
              ? [{ phone: phone.trim() }]
              : []),
            ...(gstNumber
              ? [{ gstNumber: gstNumber.trim() }]
              : []),
          ],
        },
      });

    if (duplicateOrganization) {
      return res.status(409).json({
        success: false,
        message:
          "Another organization already uses this email, phone or GST number",
      });
    }

    const organization =
      await prisma.organization.update({
        where: {
          id,
        },
        data: {
          ...(name !== undefined && {
            name: name.trim(),
          }),
          ...(address !== undefined && {
            address: address.trim(),
          }),
          ...(contactPersonName !== undefined && {
            contactPersonName:
              contactPersonName.trim(),
          }),
          ...(phone !== undefined && {
            phone: phone.trim(),
          }),
          ...(email !== undefined && {
            email: email.trim().toLowerCase(),
          }),
          ...(organizationType !== undefined && {
            organizationType:
              organizationType.trim(),
          }),
          ...(gstNumber !== undefined && {
            gstNumber: gstNumber?.trim() || null,
          }),
          ...(description !== undefined && {
            description:
              description?.trim() || null,
          }),
        },
      });

    return res.status(200).json({
      success: true,
      message: "Organization updated successfully",
      organization,
    });
  } catch (error) {
    console.error("Update organization error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update organization",
    });
  }
};

// DELETE ORGANIZATION
const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;

    const organization =
      await prisma.organization.findUnique({
        where: {
          id,
        },
        include: {
          _count: {
            select: {
              users: true,
              buildings: true,
            },
          },
        },
      });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    if (
      organization._count.users > 0 ||
      organization._count.buildings > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete organization because it has linked users or buildings",
      });
    }

    await prisma.organization.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Organization deleted successfully",
    });
  } catch (error) {
    console.error("Delete organization error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete organization",
    });
  }
};

module.exports = {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
};
