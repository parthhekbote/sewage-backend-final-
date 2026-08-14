// PURPOSE:
// This file defines ticket management and workflow routes.
// It connects ticket CRUD, assignment, start, resolution, and closure endpoints to authorized controllers.
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
    authorizeRoles("ADMIN", "OPERATOR"),
    getTickets
  );

router.patch(
  "/:id/assign",
  authorizeRoles("ADMIN"),
  assignEngineer
);

router.patch(
  "/:id/start",
  authorizeRoles("ADMIN"),
  startTicket
);

router.patch(
  "/:id/resolve",
  authorizeRoles("ADMIN"),
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
    authorizeRoles("ADMIN", "OPERATOR"),
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
