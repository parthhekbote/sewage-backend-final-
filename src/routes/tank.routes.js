const express = require("express");

const {
  createTank,
  getTanks,
  getTankById,
  updateTank,
  deleteTank,
} = require("../controllers/tank/tank.controller");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ADMIN"));

router
  .route("/")
  .post(createTank)
  .get(getTanks);

router
  .route("/:id")
  .get(getTankById)
  .put(updateTank)
  .delete(deleteTank);

module.exports = router;