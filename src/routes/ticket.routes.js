const express = require("express");

const {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  assignEngineer,
  startTicket,
  resolveTicket,
  closeTicket,
  deleteTicket,
} = require("../controllers/ticket/ticket.controller");

const protect = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

const router = express.Router();

router.use(protect);

router
  .route("/")
  .post(
    authorizeRoles("ADMIN", "OPERATOR"),
    createTicket
  )
  .get(
    authorizeRoles("ADMIN", "OPERATOR", "ENGINEER"),
    getTickets
  );

router.patch(
  "/:id/assign",
  authorizeRoles("ADMIN"),
  assignEngineer
);

router.patch(
  "/:id/start",
  authorizeRoles("ADMIN", "ENGINEER"),
  startTicket
);

router.patch(
  "/:id/resolve",
  authorizeRoles("ADMIN", "ENGINEER"),
  resolveTicket
);

router.patch(
  "/:id/close",
  authorizeRoles("ADMIN"),
  closeTicket
);

router
  .route("/:id")
  .get(
    authorizeRoles("ADMIN", "OPERATOR", "ENGINEER"),
    getTicketById
  )
  .put(
    authorizeRoles("ADMIN"),
    updateTicket
  )
  .delete(
    authorizeRoles("ADMIN"),
    deleteTicket
  );

module.exports = router;