// server/controllers/bloodStockController.js
import mongoose from "mongoose";
import BloodStock from "../models/Bloodstock.js";

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

const pick = (obj, keys) =>
  keys.reduce((acc, k) => (obj[k] !== undefined ? (acc[k] = obj[k], acc) : acc), {});

const stockDTO = (doc) => {
  if (!doc) return doc;
  const o = doc.toObject ? doc.toObject({ virtuals: true }) : { ...doc };
  return {
    _id: o._id,
    hospitalId: o.hospitalId,
    bloodGroup: o.bloodGroup,
    component: o.component,
    batches: (o.batches || []).map((b) => ({
      _id: b._id,
      units: b.units,
      collectedAt: b.collectedAt,
      expiresAt: b.expiresAt,
      note: b.note || "",
    })),
    totalUnits: doc.totalUnits ?? (o.batches || []).reduce((s, b) => s + (b.units || 0), 0),
    earliestExpiry: doc.earliestExpiry ?? (o.batches || []).reduce((min, b) => {
      if (!b.expiresAt) return min;
      const t = +new Date(b.expiresAt);
      return min === null || t < min ? t : min;
    }, null),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
};

/* =========================
   CREATE / ADD
   ========================= */

export const addBloodStock = async (req, res) => {
  try {
    const {
      hospitalId,
      bloodGroup,
      component,
      units,
      collectedAt,
      expiresAt,
      note,
      batches,
    } = req.body || {};

    if (!hospitalId || !bloodGroup || !component) {
      return res.status(400).json({ message: "hospitalId, bloodGroup, and component are required" });
    }
    if (!isObjectId(hospitalId)) {
      return res.status(400).json({ message: "Invalid hospitalId" });
    }

    let doc = await BloodStock.findOne({ hospitalId, bloodGroup, component });
    if (!doc) {
      doc = new BloodStock({ hospitalId, bloodGroup, component, batches: [] });
    }

    if (Array.isArray(batches) && batches.length) {
      for (const b of batches) {
        if (!b?.units || b.units < 1) {
          return res.status(400).json({ message: "Each batch requires units >= 1" });
        }
        doc.addBatch(pick(b, ["units", "collectedAt", "expiresAt", "note"]));
      }
    } else {
      if (!units || units < 1) {
        return res.status(400).json({ message: "units must be >= 1" });
      }
      doc.addBatch({ units, collectedAt, expiresAt, note });
    }

    await doc.save();
    return res.status(201).json({ message: "Stock saved", stock: stockDTO(doc) });
  } catch (err) {
    console.error("addBloodStock error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   VIEW / LIST
   ========================= */

/**
 * List stocks with filters & pagination.
 * Query: hospitalId?, bloodGroup?, component?, page=1, limit=10, sort="-updatedAt"
 */
export const listBloodStocks = async (req, res) => {
  try {
    const {
      hospitalId,
      bloodGroup,
      component,
      page = 1,
      limit = 10,
      sort = "-updatedAt",
    } = req.query;

    const filter = {};
    if (hospitalId) {
      if (!isObjectId(hospitalId)) return res.status(400).json({ message: "Invalid hospitalId" });
      filter.hospitalId = hospitalId;
    }
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (component) filter.component = component;

    const q = BloodStock.find(filter);
    const total = await BloodStock.countDocuments(q.getFilter());
    const docs = await q.sort(sort)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return res.json({
      total,
      page: Number(page),
      limit: Number(limit),
      stocks: docs.map(stockDTO),
    });
  } catch (err) {
    console.error("listBloodStocks error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getBloodStockById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ message: "Invalid stock id" });
    const doc = await BloodStock.findById(id);
    if (!doc) return res.status(404).json({ message: "Stock not found" });
    return res.json({ stock: stockDTO(doc) });
  } catch (err) {
    console.error("getBloodStockById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   UPDATE BATCH
   ========================= */

/**
 * Update a specific batch within a stock.
 * Params: :stockId :batchId
 * Body: { units?, collectedAt?, expiresAt?, note? }
 */
export const updateBloodBatch = async (req, res) => {
  try {
    const { stockId, batchId } = req.params;
    if (!isObjectId(stockId) || !isObjectId(batchId)) {
      return res.status(400).json({ message: "Invalid stockId or batchId" });
    }
    const doc = await BloodStock.findById(stockId);
    if (!doc) return res.status(404).json({ message: "Stock not found" });

    const batch = doc.batches.id(batchId);
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    const { units, collectedAt, expiresAt, note } = req.body || {};
    if (units !== undefined) {
      if (typeof units !== "number" || units < 0) {
        return res.status(400).json({ message: "units must be a non-negative number" });
      }
      batch.units = units;
    }
    if (collectedAt !== undefined) batch.collectedAt = collectedAt;
    if (expiresAt !== undefined) batch.expiresAt = expiresAt;
    if (note !== undefined) batch.note = note;

    await doc.save();
    return res.json({ message: "Batch updated", stock: stockDTO(doc) });
  } catch (err) {
    console.error("updateBloodBatch error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   DELETE
   ========================= */

/**
 * Delete a specific batch from a stock.
 * Params: :stockId :batchId
 */
export const deleteBloodBatch = async (req, res) => {
  try {
    const { stockId, batchId } = req.params;
    if (!isObjectId(stockId) || !isObjectId(batchId)) {
      return res.status(400).json({ message: "Invalid stockId or batchId" });
    }
    const doc = await BloodStock.findById(stockId);
    if (!doc) return res.status(404).json({ message: "Stock not found" });

    const batch = doc.batches.id(batchId);
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    batch.deleteOne();
    await doc.save();
    return res.json({ message: "Batch deleted", stock: stockDTO(doc) });
  } catch (err) {
    console.error("deleteBloodBatch error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Delete entire stock document.
 * Params: :id
 */
export const deleteBloodStock = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ message: "Invalid stock id" });
    const deleted = await BloodStock.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Stock not found" });
    return res.json({ message: "Stock deleted" });
  } catch (err) {
    console.error("deleteBloodStock error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* =========================
   SUMMARY (for charts)
   ========================= */

/**
 * Summary for charts.
 * Query:
 *  - hospitalId?   (filter to one hospital)
 *  - days=7        (expiringSoon window)
 * Returns totals by group/component + matrix + expiringSoon + expired.
 */
export const getBloodStockSummary = async (req, res) => {
  try {
    const { hospitalId, days = 7 } = req.query;
    const match = {};
    if (hospitalId) {
      if (!isObjectId(hospitalId)) return res.status(400).json({ message: "Invalid hospitalId" });
      match.hospitalId = new mongoose.Types.ObjectId(hospitalId);
    }

    const now = new Date();
    const soon = new Date(now.getTime() + Number(days) * 24 * 60 * 60 * 1000);

    // Unwind batches to aggregate per batch expiry
    const pipeline = [
      { $match: match },
      { $unwind: { path: "$batches", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          units: { $ifNull: ["$batches.units", 0] },
          expiresAt: "$batches.expiresAt",
        },
      },
      {
        $addFields: {
          isExpired: {
            $cond: [
              { $and: [{ $ne: ["$expiresAt", null] }, { $lte: ["$expiresAt", now] }] },
              true,
              false,
            ],
          },
          isExpiringSoon: {
            $cond: [
              {
                $and: [
                  { $ne: ["$expiresAt", null] },
                  { $gt: ["$expiresAt", now] },
                  { $lte: ["$expiresAt", soon] },
                ],
              },
              true,
              false,
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            hospitalId: "$hospitalId",
            bloodGroup: "$bloodGroup",
            component: "$component",
          },
          units: { $sum: "$units" },
          expiringSoonUnits: {
            $sum: { $cond: ["$isExpiringSoon", "$units", 0] },
          },
          expiredUnits: {
            $sum: { $cond: ["$isExpired", "$units", 0] },
          },
        },
      },
    ];

    const rows = await BloodStock.aggregate(pipeline);

    // Shape for charts
    let totalUnits = 0;
    const byGroup = {};
    const byComponent = {};
    const matrix = []; // rows of { bloodGroup, component, units }

    let expSoonTotal = 0;
    const expSoonByGroup = {};
    const expSoonByComponent = {};

    let expiredTotal = 0;
    const expiredByGroup = {};
    const expiredByComponent = {};

    for (const r of rows) {
      const g = r._id.bloodGroup;
      const c = r._id.component;
      const u = r.units || 0;
      const es = r.expiringSoonUnits || 0;
      const ex = r.expiredUnits || 0;

      totalUnits += u;
      byGroup[g] = (byGroup[g] || 0) + u;
      byComponent[c] = (byComponent[c] || 0) + u;
      matrix.push({ bloodGroup: g, component: c, units: u });

      expSoonTotal += es;
      expSoonByGroup[g] = (expSoonByGroup[g] || 0) + es;
      expSoonByComponent[c] = (expSoonByComponent[c] || 0) + es;

      expiredTotal += ex;
      expiredByGroup[g] = (expiredByGroup[g] || 0) + ex;
      expiredByComponent[c] = (expiredByComponent[c] || 0) + ex;
    }

    return res.json({
      filter: { hospitalId: hospitalId || null },
      totalUnits,
      byGroup: Object.entries(byGroup).map(([bloodGroup, units]) => ({ bloodGroup, units })),
      byComponent: Object.entries(byComponent).map(([component, units]) => ({ component, units })),
      matrix, // for heatmaps or stacked bar charts
      expiringSoon: {
        days: Number(days),
        totalUnits: expSoonTotal,
        byGroup: Object.entries(expSoonByGroup).map(([bloodGroup, units]) => ({ bloodGroup, units })),
        byComponent: Object.entries(expSoonByComponent).map(([component, units]) => ({ component, units })),
      },
      expired: {
        totalUnits: expiredTotal,
        byGroup: Object.entries(expiredByGroup).map(([bloodGroup, units]) => ({ bloodGroup, units })),
        byComponent: Object.entries(expiredByComponent).map(([component, units]) => ({ component, units })),
      },
    });
  } catch (err) {
    console.error("getBloodStockSummary error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//Get Units

export const getUnits = async (req, res) => {
  try {
    let { hospitalId, bloodGroup, component, scope = "all", days = 7 } = req.query;
    days = Number(days) || 7;

    if (!hospitalId) {
      if (req.user?.role === "hospital" && req.user?.hospitalId) {
        hospitalId = req.user.hospitalId;
      } else {
        return res.status(400).json({ message: "hospitalId is required" });
      }
    }
    if (!isId(hospitalId)) return res.status(400).json({ message: "Invalid hospitalId" });

    const matchBase = { hospitalId: new mongoose.Types.ObjectId(hospitalId) };
    if (bloodGroup) matchBase.bloodGroup = bloodGroup;
    if (component) matchBase.component = component;

    const now = new Date();
    const soon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // scope filter
    const scopeMatch =
      scope === "expired"
        ? { isExpired: true }
        : scope === "expiringSoon"
        ? { isExpiringSoon: true }
        : { isValid: true }; // "all" = current (not expired)

    const pipeline = [
      { $match: matchBase },
      { $unwind: { path: "$batches", preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          batchUnits: { $ifNull: ["$batches.units", 0] },
          batchExpiresAt: "$batches.expiresAt",
        },
      },
      {
        $addFields: {
          isExpired: { $lt: ["$batchExpiresAt", now] },
          isValid: { $gte: ["$batchExpiresAt", now] },
          isExpiringSoon: {
            $and: [{ $gte: ["$batchExpiresAt", now] }, { $lte: ["$batchExpiresAt", soon] }],
          },
        },
      },
      { $match: scopeMatch },
      { $group: { _id: null, units: { $sum: "$batchUnits" } } },
    ];

    const [row] = await BloodStock.aggregate(pipeline);
    return res.json({ units: row?.units || 0 });
  } catch (err) {
    console.error("getUnits error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};