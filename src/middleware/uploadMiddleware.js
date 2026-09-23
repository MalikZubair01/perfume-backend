import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

// Files go straight to Cloudinary; multer just streams them there.
// All images land under one Cloudinary root folder, split by resource type.
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // separate folders for product images vs category images, chosen by the route
    const folder =
      req.baseUrl && req.baseUrl.includes("categories")
        ? "nk-fragrances/categories"
        : "nk-fragrances/products";

    return {
      folder,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto" }],
    };
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
});

export default upload;
