// PURPOSE:
// This file defines organization management routes.
// It connects organization CRUD endpoints to controller functions with authentication and role authorization.
const express = require("express");

const {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
} = require(
  "../controllers/organization/organization.controller"
);

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router
  .route("/")
  .post(createOrganization)
  .get(getOrganizations);

router
  .route("/:id")
  .get(getOrganizationById)
  .put(updateOrganization)
  .delete(deleteOrganization);

module.exports = router;
