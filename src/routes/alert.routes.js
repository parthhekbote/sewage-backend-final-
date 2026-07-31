const express = require("express");

const {
  createAlert,
  getAlerts,
  getAlertById,
  updateAlert,
  acknowledgeAlert,
  resolveAlert,
  deleteAlert,
} = require("../controllers/alert/alert.controller");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);

router
  .route("/")
  .post(
    authorizeRoles("ADMIN", "OPERATOR"),
    createAlert
  )
  .get(
    authorizeRoles("ADMIN", "OPERATOR", "ENGINEER"),
    getAlerts
  );

router.patch(
  "/:id/acknowledge",
  authorizeRoles("ADMIN", "OPERATOR"),
  acknowledgeAlert
);

router.patch(
  "/:id/resolve",
  authorizeRoles("ADMIN", "OPERATOR", "ENGINEER"),
  resolveAlert
);

router
  .route("/:id")
  .get(
    authorizeRoles("ADMIN", "OPERATOR", "ENGINEER"),
    getAlertById
  )
  .put(
    authorizeRoles("ADMIN"),
    updateAlert
  )
  .delete(
    authorizeRoles("ADMIN"),
    deleteAlert
  );

module.exports = router;