import bcrypt from "bcrypt";
import Hospital from "../models/Hospital.js";


const SALT_ROUNDS = 10;
const MAX_LOGO_BYTES = 1 * 1024 * 1024; // 1MB
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);

/* ---------- helpers ---------- */
const base64Bytes = (b64) => {
  try {
    return Buffer.byteLength(b64 || "", "base64");
  } catch {
    return Infinity;
  }
};

const normalizeBase64 = (input) => {
  if (!input) return input;
  const comma = input.indexOf(",");
  if (input.startsWith("data:") && comma !== -1) return input.slice(comma + 1);
  return input;
};

const sanitize = (doc) => {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.password; // never return hashed password to clients
  return obj;
};

const generateHospitalCode = async () => {
  // Attempt a few times to avoid collisions
  for (let i = 0; i < 7; i++) {
    const rnd = Math.floor(100000 + Math.random() * 900000); // 6 digits
    const code = `SL/MOH/HOS${rnd}`;
    const exists = await Hospital.exists({ hospitalCode: code });
    if (!exists) return code;
  }
  throw new Error("Could not generate unique hospital code");
};

/* ---------- controllers ---------- */

// Admin: Create hospital
export const createHospital = async (req, res) => {
  try {
    const {
      name,
      district,
      address,
      email,
      password,
      phone,
      status = "Active",
      logoBase64,
      logoMimeType,
      hospitalCode, // optional; if missing we generate
    } = req.body;

    if (!name || !district || !email || !password) {
      return res.status(400).json({ message: "name, district, email, and password are required" });
    }

    // hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // ensure unique or generate hospitalCode
    const code = hospitalCode && hospitalCode.trim().length
      ? hospitalCode.trim()
      : await generateHospitalCode();

    const doc = new Hospital({
      hospitalCode: code,
      name,
      district,
      address: address || "",
      email: email.toLowerCase(),
      password: passwordHash,
      phone: phone || "",
      status,
      role: "hospital", 
      logo: {},
    });

    if (logoBase64) {
      const clean = normalizeBase64(logoBase64);
      const bytes = base64Bytes(clean);
      if (!logoMimeType || !ALLOWED_MIME.has(logoMimeType)) {
        return res.status(400).json({ message: "Invalid logo MIME type" });
      }
      if (bytes > MAX_LOGO_BYTES) {
        return res.status(400).json({ message: "Logo too large (max 1MB)" });
      }
      doc.logo = { data: clean, mimeType: logoMimeType, sizeBytes: bytes };
    }

    const saved = await doc.save();
    return res.status(201).json({ message: "Hospital created", hospital: sanitize(saved) });
  } catch (err) {
    // handle duplicate keys (email or hospitalCode)
    if (err?.code === 11000) {
      const fields = Object.keys(err.keyPattern || {});
      return res
        .status(409)
        .json({ message: `Duplicate value for: ${fields.join(", ")}` });
    }
    console.error("createHospital error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Admin: List hospitals (filters + pagination)
export const listHospitals = async (req, res) => {
  try {
    const { q, status, district, page = 1, limit = 10, sort = "-createdAt" } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (district) filter.district = district;

    let query = Hospital.find(filter);
    if (q) query = query.find({ $text: { $search: q } });

    const total = await Hospital.countDocuments(query.getFilter());
    const hospitals = await query
      .sort(sort)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return res.json({
      total,
      page: Number(page),
      limit: Number(limit),
      hospitals: hospitals.map(sanitize),
    });
  } catch (err) {
    console.error("listHospitals error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Admin: Get hospital by Mongo _id
export const getHospitalById = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    return res.json({ hospital: sanitize(hospital) });
  } catch (err) {
    console.error("getHospitalById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};



// Admin: Delete hospital by _id
export const deleteHospitalById = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Hospital.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Hospital not found" });
    return res.json({ message: "Hospital deleted" });
  } catch (err) {
    console.error("deleteHospitalById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};