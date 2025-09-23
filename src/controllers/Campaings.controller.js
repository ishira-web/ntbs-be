import path from "path";
import fs from "fs";
import Campaign from "../models/Campaing.js";

// helper: delete file safely
function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {
    // ignore
  }
}

// helper: get relative path from multer absolute
function toRelativePath(absPath) {
  if (!absPath) return null;
  const idx = absPath.lastIndexOf("uploads");
  return idx >= 0 ? absPath.substring(idx).replaceAll("\\", "/") : absPath;
}

// helper: validate dates
function assertDates(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (isNaN(start) || isNaN(end)) {
    const err = new Error("Invalid dates supplied");
    err.status = 400;
    throw err;
  }
  if (start > end) {
    const err = new Error("startAt cannot be after endAt");
    err.status = 400;
    throw err;
  }
}

/* -------------------- create -------------------- */
export async function createCampaign(req, res, next) {
  try {
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

    if (!hospitalName || !title || !startAt || !endAt) {
      return res
        .status(400)
        .json({ message: "hospitalName, title, startAt, endAt are required." });
    }

    assertDates(startAt, endAt);

    const posterImg = toRelativePath(req.file?.path);

    const doc = await Campaign.create({
      hospitalName,
      title: title?.trim(),
      organization: organization?.trim(),
      status,
      startAt,
      endAt,
      venue: venue?.trim(),
      posterImg,
      locationUrl: locationUrl?.trim(),
    });

    res.status(201).json(doc);
  } catch (err) {
    if (req.file?.path) safeUnlink(req.file.path);
    next(err);
  }
}

/* -------------------- list -------------------- */
export async function listCampaigns(req, res, next) {
  try {
    const {
      page = 1,
      limit = 10,
      q,
      status,
      from,
      to,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;

    if (from || to) {
      filter.$and = [];
      if (from) filter.$and.push({ startAt: { $gte: new Date(from) } });
      if (to) filter.$and.push({ endAt: { $lte: new Date(to) } });
      if (!filter.$and.length) delete filter.$and;
    }

    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { organization: { $regex: q, $options: "i" } },
        { venue: { $regex: q, $options: "i" } },
        { hospitalName: { $regex: q, $options: "i" } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);

    const [items, total] = await Promise.all([
      Campaign.find(filter)
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Campaign.countDocuments(filter),
    ]);

    res.json({
      data: items,
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    next(err);
  }
}

/* -------------------- get one -------------------- */
export async function getCampaign(req, res, next) {
  try {
    const doc = await Campaign.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Campaign not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

/* -------------------- update -------------------- */
export async function updateCampaign(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await Campaign.findById(id);
    if (!existing) return res.status(404).json({ message: "Campaign not found" });

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

    if (startAt || endAt) {
      assertDates(startAt ?? existing.startAt, endAt ?? existing.endAt);
    }

    let newPosterRel = existing.posterImg;
    let oldPosterAbs;

    if (req.file?.path) {
      newPosterRel = toRelativePath(req.file.path);
      if (existing.posterImg) {
        oldPosterAbs = path.resolve(process.cwd(), existing.posterImg);
      }
    }

    existing.hospitalName = hospitalName ?? existing.hospitalName;
    existing.title = title?.trim() ?? existing.title;
    existing.organization = organization?.trim() ?? existing.organization;
    if (status) existing.status = status;
    existing.startAt = startAt ?? existing.startAt;
    existing.endAt = endAt ?? existing.endAt;
    existing.venue = venue?.trim() ?? existing.venue;
    existing.locationUrl = locationUrl?.trim() ?? existing.locationUrl;
    existing.posterImg = newPosterRel;

    const saved = await existing.save();

    if (oldPosterAbs) safeUnlink(oldPosterAbs);

    res.json(saved);
  } catch (err) {
    if (req.file?.path) safeUnlink(req.file.path);
    next(err);
  }
}

/* -------------------- delete -------------------- */
export async function deleteCampaign(req, res, next) {
  try {
    const existing = await Campaign.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Campaign not found" });

    const posterAbs = existing.posterImg
      ? path.resolve(process.cwd(), existing.posterImg)
      : null;

    await existing.deleteOne();

    safeUnlink(posterAbs);

    res.json({ message: "Campaign deleted" });
  } catch (err) {
    next(err);
  }
}
