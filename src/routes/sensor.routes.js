const express = require("express");

const {
  createSensor,
  getSensors,
  getSensorById,
  updateSensor,
  deleteSensor,
} = require("../controllers/sensor/sensor.controller");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router
  .route("/")
  .post(createSensor)
  .get(getSensors);

router
  .route("/:id")
  .get(getSensorById)
  .put(updateSensor)
  .delete(deleteSensor);

module.exports = router;