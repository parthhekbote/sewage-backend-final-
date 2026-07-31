const express = require("express");

const authRoutes = require("./auth.routes");
const organizationRoutes = require("./organization.routes");
const buildingRoutes = require("./building.routes");
const plantRoutes = require("./plant.routes");
const tankRoutes = require("./tank.routes");
const sensorRoutes = require("./sensor.routes");
const sensorReadingRoutes = require("./sensorReading.routes");
const alertRoutes = require("./alert.routes");
const ticketRoutes = require("./ticket.routes");
const engineerRoutes = require("./engineer.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/organizations", organizationRoutes);
router.use("/buildings", buildingRoutes);
router.use("/plants", plantRoutes);
router.use("/tanks", tankRoutes);
router.use("/sensors", sensorRoutes);
router.use("/sensor-readings", sensorReadingRoutes);
router.use("/alerts", alertRoutes);
router.use("/tickets", ticketRoutes);
router.use("/engineers", engineerRoutes);

module.exports = router;