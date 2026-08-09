const express = require("express");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const {
  createWorkReport,
  getWorkReports,
  getWorkReportById,
  updateWorkReport,
} = require("../controllers/workReport/workReport.controller");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ENGINEER"));

router
  .route("/")
  .get(getWorkReports)
  .post(createWorkReport);

router
  .route("/:id")
  .get(getWorkReportById)
  .patch(updateWorkReport);

module.exports = router;