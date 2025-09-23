// /server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import connectDB from "./mongodb/connection.js";

// Routers
import DonorRouter from "./routes/Donor.router.js";
import HospitalRouter from "./routes/Hospital.router.js";
import adminRouter from "./routes/Admin.router.js";
import bloodstockRouter from "./routes/Bloodstock.js";
import authRouter from "./routes/authLogin.js";
import campRouter from "./routes/Campaings.router.js";
import requestRouter from "./routes/Request.router.js";
import appointmentRouter from "./routes/Appoinment.router.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

/* ---------- CORS (with credentials if needed) ---------- */
const FRONTEND_ORIGIN = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

/* ---------- Parsers ---------- */
app.use(express.json({ limit: "10mb" })); // large enough for base64 bodies if you use them
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ---------- Static file serving ---------- */
/**
 * Your project currently saves/serves posters from a "poster" directory.
 * Keep that as-is:
 *   <img src="/poster/<filename>" />
 */
const POSTER_DIR = path.join(__dirname, "poster");
if (!fs.existsSync(POSTER_DIR)) fs.mkdirSync(POSTER_DIR, { recursive: true });
app.use("/poster", express.static(POSTER_DIR));

/**
 * If you switch to the suggested multer config that saves into "uploads/campaigns",
 * this static mount will serve them too:
 *   <img src="/uploads/campaigns/<filename>" />
 */
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOADS_DIR));

/* ---------- Health check ---------- */
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "blood-bank-api", time: new Date().toISOString() });
});

/* ---------- Routes ---------- */
app.use("/api/donor", DonorRouter);
app.use("/api/hospital", HospitalRouter);
app.use("/api/admin", adminRouter);
app.use("/api/bloodstock", bloodstockRouter);
app.use("/api", authRouter);
app.use("/api/camps", campRouter);
app.use("/api/requests", requestRouter);
app.use("/api/appointments", appointmentRouter);

/* ---------- 404 handler ---------- */
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ message: "Route not found" });
});

/* ---------- Global error handler ---------- */
app.use((err, req, res, _next) => {
  console.error(err);

  // Multer errors (bad file type, too large, etc.)
  if (err?.name === "MulterError") {
    return res.status(400).json({ message: err.message });
  }

  // Mongoose validation errors
  if (err?.name === "ValidationError") {
    return res.status(422).json({
      message: "Validation failed",
      errors: Object.fromEntries(
        Object.entries(err.errors || {}).map(([k, v]) => [k, v.message])
      ),
    });
  }

  // Custom errors with status
  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Internal Server Error" });
});

/* ---------- Start server after DB connected ---------- */
(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    //   console.log(`Static posters at /poster  (dir: ${POSTER_DIR})`);
    //   console.log(`Static uploads at /uploads (dir: ${UPLOADS_DIR})`);
    });
  } catch (e) {
    console.error("Failed to connect DB:", e);
    process.exit(1);
  }
})();
