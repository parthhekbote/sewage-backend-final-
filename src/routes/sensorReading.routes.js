const express = require("express");

const {
  createSensorReading,
  getSensorReadings,
  getSensorReadingById,
  deleteSensorReading,
} = require(
  "../controllers/sensorReading/sensorReading.controller"
);

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);

router
  .route("/")
  .post(authorizeRoles("ADMIN", "OPERATOR"), createSensorReading)
  .get(authorizeRoles("ADMIN", "OPERATOR", "ENGINEER"), getSensorReadings);

router
  .route("/:id")
  .get(
    authorizeRoles("ADMIN", "OPERATOR", "ENGINEER"),
    getSensorReadingById
  )
  .delete(authorizeRoles("ADMIN"), deleteSensorReading);

module.exports = router;