const express = require("express");
const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");
const {
  getDashboard,
  getProfile,
  getPlant,
  getAlerts,
  resolveAlert,
  getTasks,
  getTaskById,
  startTask,
  completeTask,
  createTankerLog,
  getTankerLogs,
  getTankerLogById,
  uploadTankerReceipt,
  getTankerReceipt,
  createOperatorManualTest,
  getOperatorManualTests,
  getOperatorManualTestById,
  updateOperatorManualTestNotes,
  getManualTestThresholds,
  uploadTaskEvidence,
  getTaskEvidence,
} = require("../controllers/operatorApp/operatorApp.controller");
const {
  uploadTankerReceipt: tankerReceiptUpload,
} = require("../middleware/tankerReceiptUpload.middleware");
const {
  taskEvidenceUpload,
} = require("../middleware/taskEvidenceUpload.middleware");

const router = express.Router();
router.use(protect);
router.use(authorizeRoles("OPERATOR"));

router.get("/dashboard", getDashboard);
router.get("/profile", getProfile);
router.get("/plant", getPlant);
router.get("/alerts", getAlerts);
router.patch("/alerts/:id/resolve", resolveAlert);
router.get("/tasks", getTasks);
router.patch("/tasks/:id/start", startTask);
router.patch("/tasks/:id/complete", completeTask);
router.get("/tasks/:id", getTaskById);
router.post("/task-evidence", (req, res, next) => {
  taskEvidenceUpload.single("image")(req, res, (error) => {
    if (!error) return next();
    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      success: false,
      message: error.code === "LIMIT_FILE_SIZE"
        ? "Task image must not exceed 5 MB"
        : error.message || "Invalid task image",
    });
  });
}, uploadTaskEvidence);
router.get("/task-evidence/:filename", getTaskEvidence);
router
  .route("/tanker-logs")
  .post(createTankerLog)
  .get(getTankerLogs);

router.get("/tanker-logs/:id", getTankerLogById);

router.post(
  "/tanker-receipts",
  (req, res, next) => {
    tankerReceiptUpload.single("receipt")(req, res, (error) => {
      if (!error) return next();

      const statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Receipt image must not exceed 5 MB"
          : error.message || "Invalid receipt image";

      return res.status(statusCode).json({
        success: false,
        message,
      });
    });
  },
  uploadTankerReceipt
);
router.get("/tanker-receipts/:filename", getTankerReceipt);

router
  .route("/manual-tests")
  .get(getOperatorManualTests)
  .post(createOperatorManualTest);

router
  .route("/manual-tests/:id")
  .get(getOperatorManualTestById)
  .patch(updateOperatorManualTestNotes);
router.get("/manual-test-thresholds", getManualTestThresholds);


module.exports = router;
