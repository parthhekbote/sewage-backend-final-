// PURPOSE:
// This file defines building management routes.
// It connects building CRUD endpoints to controller functions with authentication and role authorization.
const express = require("express");

const {
  createBuilding,
  getBuildings,
  getBuildingById,
  updateBuilding,
  deleteBuilding,
} = require(
  "../controllers/building/building.controller"
);

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router
  .route("/")
  .post(createBuilding)
  .get(getBuildings);

router
  .route("/:id")
  .get(getBuildingById)
  .put(updateBuilding)
  .delete(deleteBuilding);

module.exports = router;
