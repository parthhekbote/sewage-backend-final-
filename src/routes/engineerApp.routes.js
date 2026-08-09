const express = require("express");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const {
  getDashboard,
  getTickets,
  getTicketById,
  getPlants,
  getPlantById,
  getSensors,
  getAlerts,
  getProfile,
  getPlantAnalytics,
  createManagedSensor,
  updateManagedSensor,
  startEngineerTicket,
  resolveEngineerTicket,
  getPlantHistory,
} = require("../controllers/engineerApp/engineerApp.controller");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ENGINEER"));

router.get("/dashboard", getDashboard);

router.get("/tickets", getTickets);
router.patch("/tickets/:id/start", startEngineerTicket);
router.patch("/tickets/:id/resolve", resolveEngineerTicket);
router.get("/tickets/:id", getTicketById);

router.get("/plants", getPlants);
router.get("/plants/:id/analytics", getPlantAnalytics);
router.get("/plants/:id/history", getPlantHistory);
router.get("/plants/:id", getPlantById);

router
  .route("/sensors")
  .get(getSensors)
  .post(createManagedSensor);

router.patch("/sensors/:id", updateManagedSensor);

router.get("/alerts", getAlerts);
router.get("/profile", getProfile);

module.exports = router;