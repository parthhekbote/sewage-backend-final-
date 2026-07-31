const express = require("express");

const {
  createEngineer,
  getEngineers,
  getAvailableEngineers,
  getEngineerById,
  updateEngineer,
  deleteEngineer,
} = require("../controllers/engineer/engineer.controller");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router.get("/available", getAvailableEngineers);

router
  .route("/")
  .post(createEngineer)
  .get(getEngineers);

router
  .route("/:id")
  .get(getEngineerById)
  .put(updateEngineer)
  .delete(deleteEngineer);

module.exports = router;