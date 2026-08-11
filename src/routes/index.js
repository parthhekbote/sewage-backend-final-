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
const engineerAppRoutes = require("./engineerApp.routes");
const operatorRoutes = require("./operator.routes");
const operatorAppRoutes = require("./operatorApp.routes");
const taskRoutes = require("./task.routes");
const visitReportRoutes = require("./visitReport.routes");
const workReportRoutes = require("./workReport.routes");
const manualTestRoutes = require("./manualTest.routes");
const clientAppRoutes = require("./clientApp.routes");
const desludgingRoutes = require("./desludging.routes");

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
router.use("/engineer", engineerAppRoutes);
router.use("/operators", operatorRoutes);
router.use("/operator", operatorAppRoutes);
router.use("/tasks", taskRoutes);
router.use("/visit-reports", visitReportRoutes);
router.use("/work-reports", workReportRoutes);
router.use("/manual-tests", manualTestRoutes);
router.use("/client", clientAppRoutes);
router.use("/desludging", desludgingRoutes);

module.exports = router;
