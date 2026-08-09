const prisma = require('../src/config/db');

const baseValues = {
  PH: 7.2,
  TSS: 24,
  BOD: 18,
  COD: 92,
  DISSOLVED_OXYGEN: 5.6,
  TURBIDITY: 12,
  H2S: 0.8,
  TEMPERATURE: 28,
};

const points = [
  { days: 0, hours: 2, delta: 0.10 },
  { days: 0, hours: 8, delta: -0.08 },
  { days: 0, hours: 18, delta: 0.04 },
  { days: 2, hours: 6, delta: -0.12 },
  { days: 5, hours: 10, delta: 0.15 },
  { days: 14, hours: 4, delta: -0.18 },
  { days: 25, hours: 12, delta: 0.20 },
  { days: 60, hours: 8, delta: -0.22 },
  { days: 150, hours: 5, delta: 0.25 },
  { days: 280, hours: 14, delta: -0.16 },
];

async function main() {
  const plants = await prisma.plant.findMany({
    where: { building: { organization: { name: 'Green Valley Apartments' } } },
    select: { tanks: { select: { sensors: { select: { id: true, type: true } } } } },
  });
  const sensors = plants.flatMap((plant) => plant.tanks.flatMap((tank) => tank.sensors));
  if (sensors.length === 0) throw new Error('No Green Valley sensors found');

  const anchor = new Date('2026-08-10T00:00:00.000Z');
  let created = 0;
  for (const sensor of sensors) {
    const base = baseValues[sensor.type] ?? 10;
    for (const point of points) {
      const recordedAt = new Date(anchor);
      recordedAt.setUTCDate(recordedAt.getUTCDate() - point.days);
      recordedAt.setUTCHours(recordedAt.getUTCHours() - point.hours);
      const exists = await prisma.sensorReading.findFirst({
        where: { sensorId: sensor.id, recordedAt },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.sensorReading.create({
        data: {
          sensorId: sensor.id,
          recordedAt,
          value: Number((base * (1 + point.delta)).toFixed(2)),
        },
      });
      created += 1;
    }
  }
  console.log(`Sensor history ready: ${created} new readings across ${sensors.length} sensors.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
