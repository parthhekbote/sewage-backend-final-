const express = require("express");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const {
  createManualTestResult,
  getManualTestResults,
  getManualTestResultById,
} = require("../controllers/manualTest/manualTest.controller");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ENGINEER"));

router
  .route("/")
  .get(getManualTestResults)
  .post(createManualTestResult);

router.get("/:id", getManualTestResultById);

module.exports = router;