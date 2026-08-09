const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const taskEvidenceDirectory = path.resolve(__dirname, "../../uploads/task-evidence");
fs.mkdirSync(taskEvidenceDirectory, { recursive: true });

const extensionByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const taskEvidenceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, taskEvidenceDirectory),
    filename: (req, file, callback) => callback(
      null,
      `${req.user.id}-${Date.now()}-${crypto.randomUUID()}${extensionByMimeType[file.mimetype]}`
    ),
  }),
  limits: { files: 1, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!extensionByMimeType[file.mimetype]) {
      return callback(new Error("Only JPG, PNG, and WEBP task images are allowed"));
    }
    return callback(null, true);
  },
});

module.exports = { taskEvidenceUpload, taskEvidenceDirectory };
