// PURPOSE:
// This file defines client app routes for organization plant data, alerts, tickets, tests, and tanker logs.
// It applies authentication, CLIENT authorization, and tanker receipt upload middleware where required.
const express = require("express");
const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");
const client = require("../controllers/clientApp/clientApp.controller");
const {
  uploadTankerReceipt: tankerReceiptUpload,
} = require("../middleware/tankerReceiptUpload.middleware");

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
router.route("/tanker-logs").get(client.getTankerLogs).post(client.createTankerLog);
router.get("/tanker-logs/:id", client.getTankerLogById);
router.post("/tanker-receipts", (req, res, next) => {
  tankerReceiptUpload.single("receipt")(req, res, (error) => {
    if (!error) return next();
    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      success: false,
      message: error.code === "LIMIT_FILE_SIZE"
        ? "Receipt image must not exceed 5 MB"
        : error.message || "Invalid receipt image",
    });
  });
}, client.uploadTankerReceipt);
router.get("/tanker-receipts/:filename", client.getTankerReceipt);

module.exports = router;
