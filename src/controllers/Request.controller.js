import mongoose from "mongoose";
import Request from "../models/Request.js";
import BloodStock from "../models/Bloodstock.js";

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

// --- CREATE ---
export const createRequest = async (req, res) => {
  try {
    const {
      hospitalId, // destination/requesting hospital
      bloodGroup,
      component,
      units,
      preferredDate,
      note,
    } = req.body || {};

    if (!hospitalId || !bloodGroup || !component || !units) {
      return res.status(400).json({ message: "hospitalId, bloodGroup, component, units are required" });
    }
    if (!isId(hospitalId)) return res.status(400).json({ message: "Invalid hospitalId" });
    if (units < 1) return res.status(400).json({ message: "units must be >= 1" });

    const reqDoc = await Request.create({
      hospitalId,
      bloodGroup,
      component,
      units,
      preferredDate: preferredDate || null,
      note: note || "",
      status: "Pending",
      createdByRole: req.user?.role || null,
      createdById: req.user?.id || null,
    });

    return res.status(201).json({ message: "Request created", request: reqDoc });
  } catch (err) {
    console.error("createRequest error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// --- LIST / VIEW ---
export const listRequests = async (req, res) => {
  try {
    const {
      hospitalId, // filter by destination
      status,
      bloodGroup,
      component,
      page = 1,
      limit = 10,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (hospitalId) {
      if (!isId(hospitalId)) return res.status(400).json({ message: "Invalid hospitalId" });
      filter.hospitalId = hospitalId;
    }
    if (status) filter.status = status;
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (component) filter.component = component;

    // If role is hospital and no filter provided, show only its own requests
    if (req.user?.role === "hospital" && !hospitalId) {
      filter.hospitalId = req.user.hospitalId;
    }

    const q = Request.find(filter);
    const total = await Request.countDocuments(q.getFilter());
    const rows = await q.sort(sort).skip((Number(page) - 1) * Number(limit)).limit(Number(limit));

    return res.json({ total, page: Number(page), limit: Number(limit), requests: rows });
  } catch (err) {
    console.error("listRequests error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: "Invalid request id" });
    const doc = await Request.findById(id);
    if (!doc) return res.status(404).json({ message: "Request not found" });

    // Hospitals can only view their own request
    if (req.user?.role === "hospital" && String(doc.hospitalId) !== String(req.user.hospitalId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json({ request: doc });
  } catch (err) {
    console.error("getRequestById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// --- APPROVE ---
export const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { sourceHospitalId } = req.body || {};

    if (!isId(id)) return res.status(400).json({ message: "Invalid request id" });
    if (!sourceHospitalId || !isId(sourceHospitalId)) {
      return res.status(400).json({ message: "sourceHospitalId is required and must be valid" });
    }

    const doc = await Request.findById(id);
    if (!doc) return res.status(404).json({ message: "Request not found" });
    if (doc.status !== "Pending") {
      return res.status(400).json({ message: `Cannot approve a ${doc.status} request` });
    }

    // Only admin or supplying hospital may approve
    const role = req.user?.role;
    if (!["admin", "hospital"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (role === "hospital" && String(req.user.hospitalId) !== String(sourceHospitalId)) {
      return res.status(403).json({ message: "Hospital can only approve from itself as source" });
    }

    // Optional: quick availability check before approval (not strict)
    const srcStock = await BloodStock.findOne({
      hospitalId: sourceHospitalId,
      bloodGroup: doc.bloodGroup,
      component: doc.component,
    });
    const available = srcStock ? srcStock.totalUnits : 0;
    if (available < doc.units) {
      return res.status(409).json({ message: `Not enough stock at source (have ${available}, need ${doc.units})` });
    }

    doc.status = "Approved";
    doc.sourceHospitalId = sourceHospitalId;
    doc.approvedAt = new Date();
    doc.approvedByRole = role;
    doc.approvedById = req.user?.id || null;

    await doc.save();
    return res.json({ message: "Request approved", request: doc });
  } catch (err) {
    console.error("approveRequest error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// --- REJECT ---
export const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: "Invalid request id" });

    const doc = await Request.findById(id);
    if (!doc) return res.status(404).json({ message: "Request not found" });
    if (!["Pending", "Approved"].includes(doc.status)) {
      return res.status(400).json({ message: `Cannot reject a ${doc.status} request` });
    }

    const role = req.user?.role;
    if (!["admin", "hospital"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    // If hospital rejects, it must be the source (if already set) or the destination (optional)
    if (role === "hospital") {
      const isSource = doc.sourceHospitalId && String(doc.sourceHospitalId) === String(req.user.hospitalId);
      const isDestination = String(doc.hospitalId) === String(req.user.hospitalId);
      if (!isSource && !isDestination) {
        return res.status(403).json({ message: "Hospital not allowed to reject this request" });
      }
    }

    doc.status = "Rejected";
    await doc.save();
    return res.json({ message: "Request rejected", request: doc });
  } catch (err) {
    console.error("rejectRequest error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// --- CANCEL (destination hospital can cancel when Pending) ---
export const cancelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: "Invalid request id" });
    const doc = await Request.findById(id);
    if (!doc) return res.status(404).json({ message: "Request not found" });
    if (doc.status !== "Pending") {
      return res.status(400).json({ message: "Only Pending requests can be cancelled" });
    }
    if (req.user?.role === "hospital" && String(doc.hospitalId) !== String(req.user.hospitalId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    doc.status = "Cancelled";
    await doc.save();
    return res.json({ message: "Request cancelled", request: doc });
  } catch (err) {
    console.error("cancelRequest error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// --- FULFILL (transfer units from source -> destination) ---
export const fulfillRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: "Invalid request id" });

    const doc = await Request.findById(id);
    if (!doc) return res.status(404).json({ message: "Request not found" });
    if (doc.status !== "Approved") {
      return res.status(400).json({ message: `Only Approved requests can be fulfilled (current: ${doc.status})` });
    }
    if (!doc.sourceHospitalId) {
      return res.status(400).json({ message: "Request has no sourceHospitalId; approve with a source first" });
    }

    // Only admin or the source hospital can fulfill
    const role = req.user?.role;
    if (!["admin", "hospital"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (role === "hospital" && String(req.user.hospitalId) !== String(doc.sourceHospitalId)) {
      return res.status(403).json({ message: "Only the source hospital can fulfill this request" });
    }

    const { bloodGroup, component, units } = doc;

    // Load source stock and ensure enough units
    const src = await BloodStock.findOne({
      hospitalId: doc.sourceHospitalId,
      bloodGroup,
      component,
    });
    const available = src ? src.totalUnits : 0;
    if (!src || available < units) {
      return res.status(409).json({ message: `Source stock insufficient (have ${available}, need ${units})` });
    }

    // Consume from source batches (earliest expiry first)
    src.batches.sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
    let remaining = units;
    const transferBatches = []; // { units, expiresAt, note }

    for (const b of src.batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.units, remaining);
      if (take > 0) {
        transferBatches.push({ units: take, collectedAt: b.collectedAt, expiresAt: b.expiresAt, note: `REQ:${doc.requestID}` });
        b.units -= take;
        remaining -= take;
      }
    }
    // Remove zeroed batches
    src.batches = src.batches.filter((b) => b.units > 0);
    await src.save();

    if (remaining > 0) {
      return res.status(409).json({ message: "Unexpected shortage during transfer" });
    }

    // Upsert destination stock and add the transfer batches
    let dst = await BloodStock.findOne({
      hospitalId: doc.hospitalId,
      bloodGroup,
      component,
    });
    if (!dst) {
      dst = new BloodStock({ hospitalId: doc.hospitalId, bloodGroup, component, batches: [] });
    }
    for (const tb of transferBatches) {
      dst.addBatch(tb);
    }
    await dst.save();

    // Mark request as fulfilled
    doc.status = "Fulfilled";
    doc.fulfilledAt = new Date();
    doc.fulfilledByRole = role;
    doc.fulfilledById = req.user?.id || null;

    await doc.save();

    return res.json({
      message: "Request fulfilled and stock transferred",
      request: doc,
      transfer: {
        from: doc.sourceHospitalId,
        to: doc.hospitalId,
        bloodGroup,
        component,
        units,
      },
    });
  } catch (err) {
    console.error("fulfillRequest error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// --- DELETE (admin only) ---
export const deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: "Invalid request id" });
    const deleted = await Request.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Request not found" });
    return res.json({ message: "Request deleted" });
  } catch (err) {
    console.error("deleteRequest error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
