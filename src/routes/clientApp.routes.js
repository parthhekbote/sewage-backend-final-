const express = require("express");
const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");
const client = require("../controllers/clientApp/clientApp.controller");

const router = express.Router();
router.use(protect);
router.use(authorizeRoles("CLIENT"));

router.get("/dashboard", client.getDashboard);
router.get("/profile", client.getProfile);
router.get("/plants", client.getPlants);
router.get("/plants/:id/analytics", client.getPlantAnalytics);
router.get("/plants/:id/history", client.getPlantHistory);
router.get("/plants/:id", client.getPlantById);
router.get("/alerts", client.getAlerts);
router.get("/operators", client.getOperators);
router.route("/tickets").get(client.getTickets).post(client.createTicket);
router.get("/tickets/:id", client.getTicketById);
router.route("/manual-tests").get(client.getManualTests).post(client.createManualTest);
router.get("/manual-tests/:id", client.getManualTestById);
router.get("/tanker-logs", client.getTankerLogs);
router.get("/tanker-logs/:id", client.getTankerLogById);
router.get("/tanker-receipts/:filename", client.getTankerReceipt);

module.exports = router;
