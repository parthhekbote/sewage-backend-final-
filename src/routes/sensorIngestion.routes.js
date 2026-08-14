// PURPOSE:
// This file defines the sensor payload ingestion route.
// It connects posted sensor payloads to the sensor ingestion controller.
const express = require("express");

const {
  ingestSensorPayload,
} = require(
  "../controllers/sensorIngestion/sensorIngestion.controller"
);

const router = express.Router();

router.post("/", ingestSensorPayload);

module.exports = router;
