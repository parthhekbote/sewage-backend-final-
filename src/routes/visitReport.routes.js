const express = require("express");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const {
  createVisitReport,
  getVisitReports,
  getVisitReportById,
} = require("../controllers/visitReport/visitReport.controller");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ENGINEER"));

router
  .route("/")
  .get(getVisitReports)
  .post(createVisitReport);

router.get("/:id", getVisitReportById);

module.exports = router;