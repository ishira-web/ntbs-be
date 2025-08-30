import mongoose from "mongoose";
import Camp, { CAMP_STATUSES } from "../models/Campaing.js";

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

const pick = (obj, keys) =>
  keys.reduce((acc, k) => (obj[k] !== undefined ? ((acc[k] = obj[k]), acc) : acc), {});

const campDTO = (doc) => {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject({ virtuals: true }) : { ...doc };
  return {
    _id: o._id,
    hospitalId: o.hospitalId,
    name: o.name,
    organizer: o.organizer,
    contact: o.contact,
    status: o.status,
    startAt: o.startAt,
    endAt: o.endAt,
    location: o.location,
    expectedDonors: o.expectedDonors,
    capacity: o.capacity,
    metrics: o.metrics,
    notes: o.notes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    isDeleted: o.isDeleted,
  };
};

/* =========================
   CREATE
   ========================= */
export const createCamp = async (req, res) => {
  try {
    const body = req.body || {};
    const required = ["hospitalId", "name", "startAt", "endAt"];
    for (const k of required) {
      if (!body[k]) return res.status(400).json({ message: `${k} is required` });
    }
    if (!isObjectId(body.hospitalId)) {
      return res.status(400).json({ message: "Invalid hospitalId" });
    }
    if (body.status && !CAMP_STATUSES.includes(body.status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const camp = new Camp({
      hospitalId: body.hospitalId,
      name: body.name,
      organizer: body.organizer,
      contact: body.contact,
      status: body.status || "planned",
      startAt: body.startAt,
      endAt: body.endAt,
      location: body.location,
      expectedDonors: body.expectedDonors,
      capacity: body.capacity,
      metrics: body.metrics,
      notes: body.notes,
      createdBy: req.user?._id, // optional if you attach auth
    });

    await camp.save();
    return res.status(201).json({ message: "Camp created", camp: campDTO(camp) });
  } catch (err) {
    console.error("createCamp error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   LIST / SEARCH
   ========================= */
/**
 * Query params:
 *  - hospitalId? (ObjectId)
 *  - status? (planned|scheduled|ongoing|completed|cancelled)
 *  - q? (search in name/organizer/city/district)
 *  - from?, to? (ISO date strings for startAt range)
 *  - page=1, limit=10
 *  - sort="-startAt"
 *  - includeDeleted=false
 */
export const listCamps = async (req, res) => {
  try {
    const {
      hospitalId,
      status,
      q,
      from,
      to,
      page = 1,
      limit = 10,
      sort = "-startAt",
      includeDeleted = "false",
    } = req.query;

    const filter = {};
    if (hospitalId) {
      if (!isObjectId(hospitalId)) return res.status(400).json({ message: "Invalid hospitalId" });
      filter.hospitalId = hospitalId;
    }
    if (status) {
      if (!CAMP_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      filter.status = status;
    }
    if (includeDeleted !== "true") filter.isDeleted = { $ne: true };

    // date window on startAt
    if (from || to) {
      filter.startAt = {};
      if (from) filter.startAt.$gte = new Date(from);
      if (to) filter.startAt.$lte = new Date(to);
    }

    // free-text search
    if (q) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: regex },
        { organizer: regex },
        { "location.city": regex },
        { "location.district": regex },
      ];
    }

    const cursor = Camp.find(filter);
    const total = await Camp.countDocuments(cursor.getFilter());
    const docs = await cursor
      .sort(sort)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return res.json({
      total,
      page: Number(page),
      limit: Number(limit),
      camps: docs.map(campDTO),
    });
  } catch (err) {
    console.error("listCamps error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   READ ONE
   ========================= */
export const getCampById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ message: "Invalid id" });
    const doc = await Camp.findById(id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: "Camp not found" });
    return res.json({ camp: campDTO(doc) });
  } catch (err) {
    console.error("getCampById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   UPDATE
   ========================= */
export const updateCamp = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const allowed = [
      "name",
      "organizer",
      "contact",
      "status",
      "startAt",
      "endAt",
      "location",
      "expectedDonors",
      "capacity",
      "metrics",
      "notes",
    ];
    const patch = pick(req.body || {}, allowed);

    if (patch.status && !CAMP_STATUSES.includes(patch.status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const doc = await Camp.findById(id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: "Camp not found" });

    Object.assign(doc, patch, { updatedBy: req.user?._id });
    await doc.save();

    return res.json({ message: "Camp updated", camp: campDTO(doc) });
  } catch (err) {
    console.error("updateCamp error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   DELETE (soft)
   ========================= */
export const deleteCamp = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ message: "Invalid id" });
    const doc = await Camp.findById(id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: "Camp not found" });

    doc.isDeleted = true;
    await doc.save();
    return res.json({ message: "Camp deleted" });
  } catch (err) {
    console.error("deleteCamp error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   QUICK METRICS PATCHES (optional helpers)
   ========================= */
export const incrementMetrics = async (req, res) => {
  try {
    const { id } = req.params;
    const { donorsRegistered = 0, donorsArrived = 0, donorsDeferred = 0, unitsCollected = 0 } =
      req.body || {};
    if (!isObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const doc = await Camp.findById(id);
    if (!doc || doc.isDeleted) return res.status(404).json({ message: "Camp not found" });

    doc.metrics.donorsRegistered = (doc.metrics.donorsRegistered || 0) + Number(donorsRegistered);
    doc.metrics.donorsArrived = (doc.metrics.donorsArrived || 0) + Number(donorsArrived);
    doc.metrics.donorsDeferred = (doc.metrics.donorsDeferred || 0) + Number(donorsDeferred);
    doc.metrics.unitsCollected = (doc.metrics.unitsCollected || 0) + Number(unitsCollected);

    await doc.save();
    return res.json({ message: "Metrics updated", camp: campDTO(doc) });
  } catch (err) {
    console.error("incrementMetrics error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
