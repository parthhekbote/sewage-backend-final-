// PURPOSE:
// This file configures the Express application and mounts the API router.
// It enables CORS, JSON request parsing, a health endpoint, and a 404 response.
const express = require("express");
const cors = require("cors");

const apiRoutes = require("./routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is running",
  });
});

app.use("/api", apiRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

module.exports = app;
