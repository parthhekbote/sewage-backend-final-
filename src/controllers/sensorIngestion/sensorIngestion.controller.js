const prisma = require("../../config/db");

const allowedSensorTypes = [
  "PH",
  "TSS",
  "BOD",
  "COD",
  "DISSOLVED_OXYGEN",
  "TURBIDITY",
  "H2S",
  "TEMPERATURE",
];

// INGEST CONCATENATED SENSOR PAYLOAD
const ingestSensorPayload = async (req, res) => {
  try {
    const { payload } = req.body;

    if (!payload || typeof payload !== "string") {
      return res.status(400).json({
        success: false,
        message: "Payload must be a non-empty string",
      });
    }

    const trimmedPayload = payload.trim();

    if (!trimmedPayload) {
      return res.status(400).json({
        success: false,
        message: "Payload must be a non-empty string",
      });
    }

    /*
      Format:

      Single:
      sensorId|sensorType|value|recordedAt

      Multiple:
      reading1#reading2#reading3
    */

    const rawReadings = trimmedPayload
      .split("#")
      .map((item) => item.trim())
      .filter(Boolean);

    if (rawReadings.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No sensor readings found in payload",
      });
    }

    const parsedReadings = [];

    for (let index = 0; index < rawReadings.length; index++) {
      const rawReading = rawReadings[index];

      const parts = rawReading.split("|");

      if (parts.length !== 4) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid reading at position ${index + 1}. ` +
            "Expected sensorId|sensorType|value|recordedAt",
        });
      }

      const [
        rawSensorId,
        rawSensorType,
        rawValue,
        rawRecordedAt,
      ] = parts;

      const sensorId = rawSensorId.trim();
      const sensorType = rawSensorType.trim().toUpperCase();
      const valueString = rawValue.trim();
      const recordedAtString = rawRecordedAt.trim();

      if (!sensorId) {
        return res.status(400).json({
          success: false,
          message:
            `sensorId is missing at reading ${index + 1}`,
        });
      }

      if (!allowedSensorTypes.includes(sensorType)) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid sensor type "${sensorType}" at reading ${index + 1}`,
        });
      }

      const value = Number(valueString);

      if (!Number.isFinite(value)) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid numeric value at reading ${index + 1}`,
        });
      }

      let recordedAt;

      if (recordedAtString) {
        recordedAt = new Date(recordedAtString);

        if (Number.isNaN(recordedAt.getTime())) {
          return res.status(400).json({
            success: false,
            message:
              `Invalid recordedAt at reading ${index + 1}`,
          });
        }
      }

      parsedReadings.push({
        sensorId,
        sensorType,
        value,
        recordedAt,
      });
    }

    const sensorIds = [
      ...new Set(
        parsedReadings.map((reading) => reading.sensorId)
      ),
    ];

    const sensors = await prisma.sensor.findMany({
      where: {
        id: {
          in: sensorIds,
        },
      },
      select: {
        id: true,
        type: true,
        enabled: true,
        minimumThreshold: true,
        maximumThreshold: true,
        unit: true,
        tankId: true,
      },
    });

    const sensorMap = new Map(
      sensors.map((sensor) => [
        sensor.id,
        sensor,
      ])
    );

    for (let index = 0; index < parsedReadings.length; index++) {
      const reading = parsedReadings[index];

      const sensor = sensorMap.get(reading.sensorId);

      if (!sensor) {
        return res.status(404).json({
          success: false,
          message:
            `Sensor "${reading.sensorId}" not found`,
        });
      }

      if (!sensor.enabled) {
        return res.status(409).json({
          success: false,
          message:
            `Sensor "${reading.sensorId}" is disabled`,
        });
      }

      if (sensor.type !== reading.sensorType) {
        return res.status(400).json({
          success: false,
          message:
            `Sensor type mismatch for sensor "${reading.sensorId}". ` +
            `Expected ${sensor.type}, received ${reading.sensorType}`,
        });
      }

      reading.sensor = sensor;
    }

    const createdReadings = await prisma.$transaction(
      parsedReadings.map((reading) =>
        prisma.sensorReading.create({
          data: {
            sensorId: reading.sensorId,
            value: reading.value,
            ...(reading.recordedAt && {
              recordedAt: reading.recordedAt,
            }),
          },
          include: {
            sensor: {
              include: {
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
              },
            },
          },
        })
      )
    );

    return res.status(201).json({
      success: true,
      message:
        createdReadings.length === 1
          ? "Sensor reading received successfully"
          : "Sensor readings received successfully",
      count: createdReadings.length,
      readings: createdReadings,
    });
  } catch (error) {
    console.error(
      "Sensor ingestion error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to process sensor payload",
    });
  }
};

module.exports = {
  ingestSensorPayload,
};