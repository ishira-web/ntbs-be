// ESM-ready Multer config for saving campaign posters locally
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Where to store files (relative to this file).
// You can change this to any absolute path you like.
const UPLOAD_DIR = path.resolve(__dirname, "..", "uploads", "campaigns");

// Ensure the directory exists at startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // e.g., poster-<timestamp>-<random>-ext
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase =
      path
        .basename(file.originalname, ext)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "poster";
    cb(null, `${safeBase}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

// Only allow image files
function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only image files are allowed (jpg, jpeg, png, webp)"));
}

export const uploadCampaignPoster = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
}).single("poster"); // field name expected from client (Postman)
