// PURPOSE:
// This file creates and exports the shared PrismaClient database client.
// Backend controllers and middleware use it for Prisma database access.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = prisma;
