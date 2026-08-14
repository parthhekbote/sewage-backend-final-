// PURPOSE:
// This script seeds pump records for tanks using named pump templates.
// It connects each created pump to its matching tank through Prisma.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const pumpTemplates = {
  "Inlet Tank": {
    name: "Inlet Pump A",
    brand: "Kirloskar",
    modelNumber: "CR-32-4",
    capacity: 32,
    powerKw: 4,
    status: "SERVICE_NEEDED",
  },
  "Anaerobic Tank": {
    name: "Recirculation Pump A",
    brand: "KSB",
    modelNumber: "ETA-40-20",
    capacity: 28,
    powerKw: 3.7,
    status: "ACTIVE",
  },
  "Settling Tank": {
    name: "Sludge Pump A",
    brand: "Crompton",
    modelNumber: "SWJ-50",
    capacity: 20,
    powerKw: 3,
    status: "ACTIVE",
  },
  "Treated Water Tank": {
    name: "Transfer Pump A",
    brand: "Grundfos",
    modelNumber: "CM-10-2",
    capacity: 35,
    powerKw: 4.5,
    status: "ACTIVE",
  },
  "Polishing Tank": {
    name: "Polishing Pump A",
    brand: "Wilo",
    modelNumber: "MHI-204",
    capacity: 24,
    powerKw: 3.2,
    status: "ACTIVE",
  },
};

async function main() {
  const tanks = await prisma.tank.findMany({
    orderBy: [{ plantId: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      plant: { select: { name: true } },
    },
  });

  let seeded = 0;
  let skipped = 0;

  for (const tank of tanks) {
    const template = pumpTemplates[tank.name];
    if (!template) {
      skipped += 1;
      continue;
    }

    const installedAt = new Date(2022, Object.keys(pumpTemplates).indexOf(tank.name), 5);
    const warrantyExpiresAt = new Date(installedAt);
    warrantyExpiresAt.setFullYear(installedAt.getFullYear() + 3);

    await prisma.pump.upsert({
      where: {
        tankId_name: {
          tankId: tank.id,
          name: template.name,
        },
      },
      create: {
        ...template,
        capacityUnit: "m³/hr",
        installedAt,
        warrantyExpiresAt,
        flowRate: template.capacity * 0.82,
        pressure: 2.5,
        runtimeHours: 3200,
        tankId: tank.id,
      },
      update: {
        brand: template.brand,
        modelNumber: template.modelNumber,
        capacity: template.capacity,
        capacityUnit: "m³/hr",
        powerKw: template.powerKw,
        installedAt,
        warrantyExpiresAt,
      },
    });

    seeded += 1;
  }

  console.log(`Pump seed complete: ${seeded} upserted, ${skipped} skipped.`);
}

main()
  .catch((error) => {
    console.error("Pump seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
