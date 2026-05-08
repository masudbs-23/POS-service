const { cloudinary } = require("../services/cloudinary");

function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        ...options,
      },
      (err, result) => {
        if (err) return reject(err);
        return resolve(result);
      }
    );

    stream.end(buffer);
  });
}

module.exports = { uploadBufferToCloudinary };

