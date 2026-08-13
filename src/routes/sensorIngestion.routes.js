const express = require("express");

const {
  ingestSensorPayload,
} = require(
  "../controllers/sensorIngestion/sensorIngestion.controller"
);

const router = express.Router();

router.post("/", ingestSensorPayload);

module.exports = router;