// server/controllers/campaign.controller.js
import mongoose from "mongoose";
import Campaign from "../models/Campaing.js"; // your model path
import cloudinary from "../middleware/cloudinary.js";

const FOLDER = process.env.CLOUDINARY_CAMPAIGN_FOLDER || "campaign_posters";

// helper: upload buffer to cloudinary (stream)
const uploadBufferToCloudinary = (buffer, filename) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, resource_type: "image", public_id: filename || undefined, overwrite: true },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

export const createCampaign = async (req, res) => {
  try {
    const {
      hospitalName,
      title,
      organization,
      status, // planned | ongoing | completed | cancelled
      startAt,
      endAt,
      venue,
      locationUrl,
    } = req.body;

    if (!hospitalName || !title || !startAt || !endAt) {
      return res.status(400).json({ message: "hospitalName, title, startAt, endAt are required." });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ message: "startAt/endAt must be valid dates." });
    }
    if (end < start) {
      return res.status(400).json({ message: "endAt cannot be earlier than startAt." });
    }

    let posterImg, posterPublicId;

    // If a file came through multer, upload to Cloudinary
    if (req.file) {
      const upload = await uploadBufferToCloudinary(req.file.buffer, undefined);
      posterImg = upload.secure_url;
      posterPublicId = upload.public_id;
    }

    const campaign = await Campaign.create({
      hospitalName,
      title,
      organization,
      status,
      startAt: start,
      endAt: end,
      venue,
      posterImg,
      posterPublicId, // add this field to the model (below) so we can delete later
      locationUrl,
    });

    return res.status(201).json({ message: "Campaign created", data: campaign });
  } catch (err) {
    console.error("createCampaign error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

export const getCampaigns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "-startAt", // default: newest starting first
      status,
      q, // search term in title/organization/hospitalName/venue
    } = req.query;

    const filter = {};
    if (status) filter.status = status;

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { organization: { $regex: q, $options: "i" } },
        { hospitalName: { $regex: q, $options: "i" } },
        { venue: { $regex: q, $options: "i" } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);

    const [items, total] = await Promise.all([
      Campaign.find(filter).sort(sort).skip((pageNum - 1) * limitNum).limit(limitNum),
      Campaign.countDocuments(filter),
    ]);

    return res.json({
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("getCampaigns error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const campaign = await Campaign.findById(id);
    if (!campaign) return res.status(404).json({ message: "Not found" });

    return res.json({ data: campaign });
  } catch (err) {
    console.error("getCampaignById error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

export const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const existing = await Campaign.findById(id);
    if (!existing) return res.status(404).json({ message: "Not found" });

    const updates = { ...req.body };

    // Validate dates if provided
    if (updates.startAt) updates.startAt = new Date(updates.startAt);
    if (updates.endAt) updates.endAt = new Date(updates.endAt);
    if (updates.startAt && isNaN(updates.startAt)) return res.status(400).json({ message: "Invalid startAt" });
    if (updates.endAt && isNaN(updates.endAt)) return res.status(400).json({ message: "Invalid endAt" });
    if (updates.startAt && updates.endAt && updates.endAt < updates.startAt) {
      return res.status(400).json({ message: "endAt cannot be earlier than startAt" });
    }

    // If replacing poster
    if (req.file) {
      // delete old if exists
      if (existing.posterPublicId) {
        try { await cloudinary.uploader.destroy(existing.posterPublicId); } catch (_) {}
      }
      const upload = await uploadBufferToCloudinary(req.file.buffer, undefined);
      updates.posterImg = upload.secure_url;
      updates.posterPublicId = upload.public_id;
    }

    const updated = await Campaign.findByIdAndUpdate(id, updates, { new: true });
    return res.json({ message: "Campaign updated", data: updated });
  } catch (err) {
    console.error("updateCampaign error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

export const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const existing = await Campaign.findById(id);
    if (!existing) return res.status(404).json({ message: "Not found" });

    if (existing.posterPublicId) {
      try { await cloudinary.uploader.destroy(existing.posterPublicId); } catch (_) {}
    }

    await Campaign.findByIdAndDelete(id);
    return res.json({ message: "Campaign deleted" });
  } catch (err) {
    console.error("deleteCampaign error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};
