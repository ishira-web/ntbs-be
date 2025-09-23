// controllers/campaignController.js
import fs from "fs";
import path from "path";
import multer from "multer";
import Campaign from "../models/Campaing.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure /poster dir exists at project root
const posterDir = path.resolve(__dirname, "..", "..", "poster");
if (!fs.existsSync(posterDir)) {
  fs.mkdirSync(posterDir, { recursive: true });
}

// ---- Multer disk storage (save a real file into /poster) ----
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, posterDir),
  filename: (_req, file, cb) => {
    // keep a readable but unique-ish filename
    const safe = file.originalname.replace(/\s+/g, "_").replace(/[^\w.\-]/g, "");
    cb(null, `${Date.now()}_${safe}`);
  },
});
export const uploadPoster = multer({ storage }).single("poster"); // form field name: poster

// ---- Helpers ----
function toBase64DataUri(absFilePath, mimetype) {
  const b64 = fs.readFileSync(absFilePath, { encoding: "base64" });
  // Data URI allows you to render directly in <img src="...">
  return `data:${mimetype};base64,${b64}`;
}

// ---- Controllers ----
export async function createCampaign(req, res) {
  try {
    const {
      hospitalName, // ObjectId
      title,
      organization,
      status,       // planned | ongoing | completed | cancelled
      startAt,
      endAt,
      venue,
      locationUrl,
    } = req.body;

    if (!hospitalName || !title || !startAt || !endAt) {
      return res.status(400).json({ message: "hospitalName, title, startAt, endAt are required." });
    }

    // Basic date sanity
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: "startAt/endAt must be valid dates." });
    }
    if (end < start) {
      return res.status(400).json({ message: "endAt must be after startAt." });
    }

    // Poster handling:
    // - If a file was uploaded, save file (multer already did), then also store Base64 in DB.
    let posterImg = undefined;
    if (req.file) {
      posterImg = toBase64DataUri(req.file.path, req.file.mimetype);
    }

    const doc = await Campaign.create({
      hospitalName,
      title,
      organization,
      status,
      startAt: start,
      endAt: end,
      venue,
      locationUrl,
      posterImg, // Base64 data URI or undefined
    });

    return res.status(201).json(doc);
  } catch (err) {
    console.error("createCampaign error:", err);
    return res.status(500).json({ message: "Failed to create campaign.", error: err.message });
  }
}

export async function listCampaigns(_req, res) {
  try {
    // You can project out posterImg if responses get too heavy
    const items = await Campaign.find().sort({ startAt: -1 }).lean();
    return res.json(items);
  } catch (err) {
    console.error("listCampaigns error:", err);
    return res.status(500).json({ message: "Failed to fetch campaigns.", error: err.message });
  }
}

export async function getCampaign(req, res) {
  try {
    const { id } = req.params;
    const item = await Campaign.findById(id);
    if (!item) return res.status(404).json({ message: "Campaign not found." });
    return res.json(item);
  } catch (err) {
    console.error("getCampaign error:", err);
    return res.status(500).json({ message: "Failed to fetch campaign.", error: err.message });
  }
}

export async function updateCampaign(req, res) {
  try {
    const { id } = req.params;
    const {
      hospitalName,
      title,
      organization,
      status,
      startAt,
      endAt,
      venue,
      locationUrl,
    } = req.body;

    const patch = {
      ...(hospitalName && { hospitalName }),
      ...(title && { title }),
      ...(organization && { organization }),
      ...(status && { status }),
      ...(venue && { venue }),
      ...(locationUrl && { locationUrl }),
    };

    if (startAt) {
      const s = new Date(startAt);
      if (Number.isNaN(s.getTime())) return res.status(400).json({ message: "startAt invalid." });
      patch.startAt = s;
    }
    if (endAt) {
      const e = new Date(endAt);
      if (Number.isNaN(e.getTime())) return res.status(400).json({ message: "endAt invalid." });
      patch.endAt = e;
    }
    if (patch.startAt && patch.endAt && patch.endAt < patch.startAt) {
      return res.status(400).json({ message: "endAt must be after startAt." });
    }

    // If a new poster file is uploaded, replace posterImg with new Base64
    if (req.file) {
      patch.posterImg = toBase64DataUri(req.file.path, req.file.mimetype);
    }

    const updated = await Campaign.findByIdAndUpdate(id, patch, { new: true });
    if (!updated) return res.status(404).json({ message: "Campaign not found." });
    return res.json(updated);
  } catch (err) {
    console.error("updateCampaign error:", err);
    return res.status(500).json({ message: "Failed to update campaign.", error: err.message });
  }
}

export async function deleteCampaign(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Campaign.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Campaign not found." });

    // NOTE: We saved the physical file in /poster but only kept Base64 in DB.
    // Without storing the saved filename/path in DB, we cannot reliably delete the disk file here.
    // If you want auto-cleanup, add a `posterFileName` field in your schema and save it during upload.

    return res.json({ message: "Campaign deleted." });
  } catch (err) {
    console.error("deleteCampaign error:", err);
    return res.status(500).json({ message: "Failed to delete campaign.", error: err.message });
  }
}
