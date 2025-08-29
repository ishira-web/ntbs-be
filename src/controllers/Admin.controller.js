import bcrypt from "bcrypt";
import Admin from "../models/Admin.js";

const SALT_ROUNDS = 10;

const sanitize = (doc) => {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.password;
  return obj;
};

// Create admin
export const createAdmin = async (req, res) => {
  
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, and password are required" });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const admin = new Admin({
      name,
      email: String(email).toLowerCase(),
      password: hash,
      role: "admin", // force admin role
    });

    const saved = await admin.save();
    return res.status(201).json({ message: "Admin created", admin: sanitize(saved) });
  } catch (err) {
    if (err?.code === 11000) {
      const fields = Object.keys(err.keyPattern || {});
      return res.status(409).json({ message: `Duplicate value for: ${fields.join(", ")}` });
    }
    console.error("createAdmin error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get all admins
export const listAdmins = async (_req, res) => {
  try {
    const admins = await Admin.find().lean();
    const clean = admins.map(({ password, ...rest }) => rest);
    return res.json({ count: clean.length, admins: clean });
  } catch (err) {
    console.error("listAdmins error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get admin by Mongo _id
export const getAdminById = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await Admin.findById(id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    return res.json({ admin: sanitize(admin) });
  } catch (err) {
    console.error("getAdminById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Update admin by _id (re-hash password if provided). adminId is immutable.
export const updateAdminById = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Admin.findById(id);
    if (!existing) return res.status(404).json({ message: "Admin not found" });

    const { name, email, password, role } = req.body;

    if (name !== undefined) existing.name = name;
    if (email !== undefined) existing.email = String(email).toLowerCase();
    if (password !== undefined && password !== "") {
      existing.password = await bcrypt.hash(password, SALT_ROUNDS);
    }
    // lock role to admin regardless of input
    if (role !== undefined && role !== "admin") {
      return res.status(400).json({ message: "Role must be 'admin'" });
    }
    existing.role = "admin";

    const saved = await existing.save();
    return res.json({ message: "Admin updated", admin: sanitize(saved) });
  } catch (err) {
    if (err?.code === 11000) {
      const fields = Object.keys(err.keyPattern || {});
      return res.status(409).json({ message: `Duplicate value for: ${fields.join(", ")}` });
    }
    console.error("updateAdminById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Delete admin by _id
export const deleteAdminById = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Admin.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Admin not found" });
    return res.json({ message: "Admin deleted" });
  } catch (err) {
    console.error("deleteAdminById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
