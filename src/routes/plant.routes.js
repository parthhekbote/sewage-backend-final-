const express = require("express");

const {
  createPlant,
  getPlants,
  getPlantById,
  updatePlant,
  deletePlant,
} = require("../controllers/plant/plant.controller");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router
  .route("/")
  .post(createPlant)
  .get(getPlants);

router
  .route("/:id")
  .get(getPlantById)
  .put(updatePlant)
  .delete(deletePlant);

module.exports = router;