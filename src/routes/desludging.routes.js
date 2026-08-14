// PURPOSE:
// This file defines the desludging record workflow routes.
// It connects listing, scheduling, rescheduling, cancellation, start, and completion actions to role-authorized controllers.
const express = require("express");
const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");
const controller = require("../controllers/desludging/desludging.controller");

const router = express.Router();
router.use(protect);
router.get("/", authorizeRoles("ADMIN", "ENGINEER", "OPERATOR", "CLIENT"), controller.listDesludging);
router.get("/:id", authorizeRoles("ADMIN", "ENGINEER", "OPERATOR", "CLIENT"), controller.getDesludging);
router.post("/", authorizeRoles("ENGINEER"), controller.scheduleDesludging);
router.patch("/:id/reschedule", authorizeRoles("ENGINEER"), controller.rescheduleDesludging);
router.patch("/:id/cancel", authorizeRoles("ENGINEER"), controller.cancelDesludging);
router.patch("/:id/start", authorizeRoles("OPERATOR"), controller.startDesludging);
router.patch("/:id/complete", authorizeRoles("OPERATOR"), controller.completeDesludging);
module.exports = router;
