const multer = require("multer");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (req, file, cb) => {
    const ok = typeof file.mimetype === "string" && file.mimetype.startsWith("image/");
    if (!ok) {
      const err = new Error("Only image files are allowed");
      err.status = 400;
      err.code = "E400";
      return cb(err);
    }
    return cb(null, true);
  },
});

module.exports = { uploadImage, MAX_IMAGE_BYTES };

