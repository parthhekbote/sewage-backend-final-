const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const organizationsData = [
  {
    name: "Green Valley Apartments",
    address: "Whitefield Main Road, Bengaluru, Karnataka",
    contactPersonName: "Rahul Mehta",
    phone: "9000000001",
    email: "greenvalley@example.com",
    organizationType: "RESIDENTIAL",
    gstNumber: "29ABCDE1001F1Z1",
    description: "Large residential apartment community",
  },
  {
    name: "Tech Park One",
    address: "Electronic City Phase 1, Bengaluru, Karnataka",
    contactPersonName: "Sneha Rao",
    phone: "9000000002",
    email: "techparkone@example.com",
    organizationType: "COMMERCIAL",
    gstNumber: "29ABCDE1002F1Z2",
    description: "Commercial technology park",
  },
  {
    name: "Sunrise Hospital",
    address: "Bannerghatta Road, Bengaluru, Karnataka",
    contactPersonName: "Dr. Arjun Nair",
    phone: "9000000003",
    email: "sunrisehospital@example.com",
    organizationType: "HOSPITAL",
    gstNumber: "29ABCDE1003F1Z3",
    description: "Multi-speciality hospital",
  },
  {
    name: "Lakeview Residency",
    address: "Bellandur, Bengaluru, Karnataka",
    contactPersonName: "Priya Sharma",
    phone: "9000000004",
    email: "lakeview@example.com",
    organizationType: "RESIDENTIAL",
    gstNumber: "29ABCDE1004F1Z4",
    description: "Premium residential society",
  },
  {
    name: "Orchid International School",
    address: "Sarjapur Road, Bengaluru, Karnataka",
    contactPersonName: "Anita Joseph",
    phone: "9000000005",
    email: "orchidschool@example.com",
    organizationType: "EDUCATIONAL",
    gstNumber: "29ABCDE1005F1Z5",
    description: "International educational campus",
  },
  {
    name: "Metro Shopping Mall",
    address: "Mahadevapura, Bengaluru, Karnataka",
    contactPersonName: "Vikram Singh",
    phone: "9000000006",
    email: "metromall@example.com",
    organizationType: "COMMERCIAL",
    gstNumber: "29ABCDE1006F1Z6",
    description: "Large retail shopping mall",
  },
  {
    name: "Royal Heights",
    address: "Hebbal, Bengaluru, Karnataka",
    contactPersonName: "Kiran Patel",
    phone: "9000000007",
    email: "royalheights@example.com",
    organizationType: "RESIDENTIAL",
    gstNumber: "29ABCDE1007F1Z7",
    description: "High-rise residential property",
  },
  {
    name: "Global Business Center",
    address: "Outer Ring Road, Bengaluru, Karnataka",
    contactPersonName: "Naveen Kumar",
    phone: "9000000008",
    email: "globalbusiness@example.com",
    organizationType: "COMMERCIAL",
    gstNumber: "29ABCDE1008F1Z8",
    description: "Corporate business center",
  },
  {
    name: "City Care Hospital",
    address: "Indiranagar, Bengaluru, Karnataka",
    contactPersonName: "Dr. Meera Iyer",
    phone: "9000000009",
    email: "citycare@example.com",
    organizationType: "HOSPITAL",
    gstNumber: "29ABCDE1009F1Z9",
    description: "Urban healthcare facility",
  },
  {
    name: "Silver Oak Apartments",
    address: "Marathahalli, Bengaluru, Karnataka",
    contactPersonName: "Rohit Verma",
    phone: "9000000010",
    email: "silveroak@example.com",
    organizationType: "RESIDENTIAL",
    gstNumber: "29ABCDE1010F1Z0",
    description: "Residential apartment complex",
  },
  {
    name: "National Engineering College",
    address: "Yelahanka, Bengaluru, Karnataka",
    contactPersonName: "Prof. Sanjay Menon",
    phone: "9000000011",
    email: "nationalcollege@example.com",
    organizationType: "EDUCATIONAL",
    gstNumber: "29ABCDE1011F1Z1",
    description: "Engineering and technology college",
  },
  {
    name: "Grand Plaza Hotel",
    address: "MG Road, Bengaluru, Karnataka",
    contactPersonName: "Amit Kapoor",
    phone: "9000000012",
    email: "grandplaza@example.com",
    organizationType: "HOSPITALITY",
    gstNumber: "29ABCDE1012F1Z2",
    description: "Business and luxury hotel",
  },
  {
    name: "Eco Industrial Estate",
    address: "Peenya Industrial Area, Bengaluru, Karnataka",
    contactPersonName: "Deepak Shetty",
    phone: "9000000013",
    email: "ecoindustrial@example.com",
    organizationType: "INDUSTRIAL",
    gstNumber: "29ABCDE1013F1Z3",
    description: "Industrial production estate",
  },
  {
    name: "Palm Meadows",
    address: "KR Puram, Bengaluru, Karnataka",
    contactPersonName: "Neha Gupta",
    phone: "9000000014",
    email: "palmmeadows@example.com",
    organizationType: "RESIDENTIAL",
    gstNumber: "29ABCDE1014F1Z4",
    description: "Gated residential community",
  },
  {
    name: "Central Convention Center",
    address: "Tumkur Road, Bengaluru, Karnataka",
    contactPersonName: "Suresh Reddy",
    phone: "9000000015",
    email: "centralconvention@example.com",
    organizationType: "COMMERCIAL",
    gstNumber: "29ABCDE1015F1Z5",
    description: "Conference and exhibition facility",
  },
];

async function clearDatabase() {
  console.log("Clearing existing seed data...");

  // Child records must be deleted before parent records.
  // Uncomment these when those tables contain data in your project.

  // await prisma.sensorReading.deleteMany();
  // await prisma.alert.deleteMany();
  // await prisma.ticket.deleteMany();
  // await prisma.sensor.deleteMany();
  // await prisma.tank.deleteMany();

  await prisma.user.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.building.deleteMany();
  await prisma.organization.deleteMany();
}

async function createOrganizations() {
  const organizations = [];

  for (const organizationData of organizationsData) {
    const organization = await prisma.organization.create({
      data: organizationData,
    });

    organizations.push(organization);
  }

  console.log(`Created ${organizations.length} organizations`);

  return organizations;
}

async function createBuildingsAndPlants(organizations) {
  const plants = [];

  for (let index = 0; index < organizations.length; index += 1) {
    const organization = organizations[index];

    const building = await prisma.building.create({
      data: {
        name: `${organization.name} Main Building`,
        location: organization.address,
        organizationId: organization.id,
      },
    });

    const plantNumber = String(index + 1).padStart(2, "0");

    const plant = await prisma.plant.create({
      data: {
        name: `${organization.name} STP`,
        code: `STP-${plantNumber}`,
        address: organization.address,
        city: "Bengaluru",
        state: "Karnataka",
        pincode: `560${String(index + 1).padStart(3, "0")}`,
        capacity: 100 + index * 25,
        technology: index % 2 === 0 ? "MBBR" : "SBR",
        commissioningDate: new Date(
          2023,
          index % 12,
          Math.min(index + 1, 28)
        ),
        buildingId: building.id,
      },
    });

    await prisma.plantMetrics.create({
      data: {
        id: `metrics-${plant.id}`,
        plantId: plant.id,
        treatedWater: 100 + index * 8.5,
        flowRate: 10 + index * 0.6,
        energyConsumption: 45 + index * 2.5,
        complianceScore: Math.max(82, 96 - index),
        violations: index % 3,
        sensorsOnline: 35,
        sensorsTotal: 35,
      },
    });

    plants.push(plant);
  }

  console.log(`Created ${organizations.length} buildings`);
  console.log(`Created ${plants.length} plants`);

  return plants;
}

async function createTanksAndPumps(plants) {
  const tankTemplates = [
    {
      name: "Inlet Tank",
      pump: {
        name: "Inlet Pump A",
        brand: "Kirloskar",
        modelNumber: "CR-32-4",
        capacity: 32,
        powerKw: 4,
      },
    },
    {
      name: "Anaerobic Tank",
      pump: {
        name: "Recirculation Pump A",
        brand: "KSB",
        modelNumber: "ETA-40-20",
        capacity: 28,
        powerKw: 3.7,
      },
    },
    {
      name: "Settling Tank",
      pump: {
        name: "Sludge Pump A",
        brand: "Crompton",
        modelNumber: "SWJ-50",
        capacity: 20,
        powerKw: 3,
      },
    },
    {
      name: "Treated Water Tank",
      pump: {
        name: "Transfer Pump A",
        brand: "Grundfos",
        modelNumber: "CM-10-2",
        capacity: 35,
        powerKw: 4.5,
      },
    },
    {
      name: "Polishing Tank",
      pump: {
        name: "Polishing Pump A",
        brand: "Wilo",
        modelNumber: "MHI-204",
        capacity: 24,
        powerKw: 3.2,
      },
    },
  ];

  let tankCount = 0;
  let pumpCount = 0;

  for (let plantIndex = 0; plantIndex < plants.length; plantIndex += 1) {
    const plant = plants[plantIndex];

    for (let tankIndex = 0; tankIndex < tankTemplates.length; tankIndex += 1) {
      const template = tankTemplates[tankIndex];
      const installedAt = new Date(2021 + (plantIndex % 3), tankIndex, 5);
      const warrantyExpiresAt = new Date(installedAt);
      warrantyExpiresAt.setFullYear(installedAt.getFullYear() + 3);

      await prisma.tank.create({
        data: {
          name: template.name,
          capacity: 1000 + tankIndex * 250,
          status: "ACTIVE",
          plantId: plant.id,
          pumps: {
            create: {
              ...template.pump,
              status: tankIndex === 0 ? "SERVICE_NEEDED" : "ACTIVE",
              capacityUnit: "m³/hr",
              installedAt,
              warrantyExpiresAt,
              flowRate: template.pump.capacity * 0.82,
              pressure: 2.5 + tankIndex * 0.2,
              runtimeHours: 3200 + plantIndex * 120 + tankIndex * 80,
            },
          },
        },
      });

      tankCount += 1;
      pumpCount += 1;
    }
  }

  console.log(`Created ${tankCount} tanks`);
  console.log(`Created ${pumpCount} pumps`);
}

async function createAdminUsers(passwordHash) {
  const admins = [
    {
      name: "Super Admin",
      email: "admin@sewage.com",
      phone: "9999999901",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
    {
      name: "Operations Admin",
      email: "admin2@sewage.com",
      phone: "9999999902",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  ];

  for (const admin of admins) {
    await prisma.user.create({
      data: admin,
    });
  }

  console.log(`Created ${admins.length} admin users`);
}

async function createOperatorUsers(
  organizations,
  plants,
  passwordHash
) {
  const operatorNames = [
    "Arun Kumar",
    "Manoj Singh",
    "Rakesh Patel",
    "Sanjay Rao",
    "Vijay Sharma",
    "Karthik Nair",
    "Akash Verma",
    "Nitin Reddy",
    "Pradeep Shetty",
    "Rahul Joshi",
  ];

  for (let index = 0; index < operatorNames.length; index += 1) {
    await prisma.user.create({
      data: {
        name: operatorNames[index],
        email: `operator${index + 1}@sewage.com`,
        phone: `98888000${String(index + 1).padStart(2, "0")}`,
        passwordHash,
        role: "OPERATOR",
        status: "ACTIVE",
        organizationId: organizations[index].id,
        plantId: plants[index].id,
      },
    });
  }

  console.log(`Created ${operatorNames.length} operator users`);
}

async function main() {
  console.log("Starting database seed...");

  await clearDatabase();

  const passwordHash = await bcrypt.hash("Password@123", 12);

  const organizations = await createOrganizations();
  const plants = await createBuildingsAndPlants(organizations);

  await createTanksAndPumps(plants);

  await createAdminUsers(passwordHash);

  await createOperatorUsers(
    organizations,
    plants,
    passwordHash
  );

  console.log("");
  console.log("Database seeded successfully");
  console.log("");
  console.log("Admin login 1:");
  console.log("Email: admin@sewage.com");
  console.log("Password: Password@123");
  console.log("");
  console.log("Admin login 2:");
  console.log("Email: admin2@sewage.com");
  console.log("Password: Password@123");
  console.log("");
  console.log("Operator login example:");
  console.log("Email: operator1@sewage.com");
  console.log("Password: Password@123");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
