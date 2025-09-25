// /server/configs/multer-campaign.js
import multer from "multer";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const UPLOAD_DIR = path.join(process.cwd(), "server", "uploads"); // adjust if your root differs
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `poster-${unique}${path.extname(file.originalname)}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!/^image\//.test(file.mimetype)) return cb(new Error("Only image files are allowed"));
  cb(null, true);
}

export const uploadCampaignPoster = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const blogStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "blogs",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  },
});

function blogImageFilter(_req, file, cb) {
  if (!/^image\//.test(file.mimetype)) return cb(new Error("Only image files are allowed"));
  cb(null, true);
}

export const uploadBlogImage = multer({
  storage: blogStorage,
  fileFilter: blogImageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export { cloudinary };