const express = require("express");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const {
  createOperator,
  getOperators,
  getOperatorById,
  updateOperator,
  deleteOperator,
} = require("../controllers/operator/operator.controller");

const router = express.Router();

router.use(protect);
router.use(authorizeRoles("ENGINEER"));

router
  .route("/")
  .get(getOperators)
  .post(createOperator);

router
  .route("/:id")
  .get(getOperatorById)
  .patch(updateOperator)
  .delete(deleteOperator);

module.exports = router;