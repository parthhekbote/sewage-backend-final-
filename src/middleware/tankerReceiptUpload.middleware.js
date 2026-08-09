const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const uploadDirectory = path.resolve(
  __dirname,
  "../../uploads/tanker-receipts"
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const extensionByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },
  filename: (req, file, callback) => {
    const extension = extensionByMimeType[file.mimetype];
    callback(
      null,
      `${req.user.id}-${Date.now()}-${crypto.randomUUID()}${extension}`
    );
  },
});

const uploadTankerReceipt = multer({
  storage,
  limits: {
    files: 1,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!extensionByMimeType[file.mimetype]) {
      return callback(new Error("Only JPG, PNG, and WEBP receipt images are allowed"));
    }

    return callback(null, true);
  },
});

module.exports = {
  uploadTankerReceipt,
  uploadDirectory,
};
