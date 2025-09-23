// server/lib/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const campImagesStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "blood-donations/camps",
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    };
  },
});

export const uploadCampImages = multer({
  storage: campImagesStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image
    files: 5, // up to 5 images per request
  },
});

export { cloudinary };
