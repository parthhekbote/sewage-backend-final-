// PURPOSE:
// This file defines task management and status workflow routes.
// It connects task CRUD, start, and completion endpoints to authorized controller functions.
const express = require("express");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  startTask,
  completeTask,
} = require("../controllers/task/task.controller");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ENGINEER"));

router
  .route("/")
  .get(getTasks)
  .post(createTask);

router.patch("/:id/start", startTask);
router.patch("/:id/complete", completeTask);

router
  .route("/:id")
  .get(getTaskById)
  .patch(updateTask);

module.exports = router;
