// server/controllers/donorController.js
import Donor from "../models/Donor.js";
import Hospital from "../models/Hospital.js";
import bcrypt from "bcrypt";

const sanitize = (doc) => {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  return obj;
};

// POST /api/donors
// Always create with confirmation.status = "Pending"
export const createDonor = async (req, res) => {
  try {
    const {
      name,
      nic,
      email,
      phone,
      dateOfBirth,
      gender,
      bloodGroup,
      weightKg,
      addressLine1,
      city,
      district,
      password,
      nearestHospitalId,
      lastDonationDate,
      chronicIllness = false,
      medications = "",
      recentTattooMonths = 0,
    } = req.body;

    if (
      !name ||
      !nic ||
      !email ||
      !phone ||
      !dateOfBirth ||
      !gender ||
      !bloodGroup ||
      !district ||
      !nearestHospitalId ||
      !weightKg ||
      !password
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const hospitalExists = await Hospital.exists({ _id: nearestHospitalId });
    if (!hospitalExists) {
      return res.status(400).json({ message: "nearestHospitalId is invalid" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const donor = new Donor({
      name,
      nic: String(nic).toUpperCase().trim(),
      email: String(email).toLowerCase().trim(),
      phone,
      dateOfBirth,
      gender,
      bloodGroup,
      weightKg,
      addressLine1: addressLine1 || "",
      city: city || "",
      district,
      password: hashedPassword,
      nearestHospitalId,
      medical: {
        lastDonationDate: lastDonationDate || null,
        chronicIllness: !!chronicIllness,
        medications,
        recentTattooMonths: Number(recentTattooMonths || 0),
      },
      confirmation: {
        status: "Pending",
        confirmedAt: null,
        confirmedByRole: null,
        confirmedById: null,
      },
      role: "donor",
    });

    // 🔒 Force Pending even if someone tries to send confirmation in body
    donor.confirmation.status = "Pending";
    donor.confirmation.confirmedAt = null;
    donor.confirmation.confirmedByRole = null;
    donor.confirmation.confirmedById = null;

    const saved = await donor.save();
    return res.status(201).json({ message: "Donor created", donor: sanitize(saved) });
  } catch (err) {
    if (err?.code === 11000) {
      const fields = Object.keys(err.keyPattern || {});
      return res.status(409).json({ message: `Duplicate value for: ${fields.join(", ")}` });
    }
    console.error("createDonor error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/donors
export const listDonors = async (req, res) => {
  try {
    const {
      q,
      status, // Pending | Confirmed | Rejected
      bloodGroup,
      district,
      page = 1,
      limit = 10,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (status) filter["confirmation.status"] = status;
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (district) filter.district = district;
    if (q) {
      const regex = new RegExp(q, "i");
      filter.$or = [{ name: regex }, { nic: regex }, { email: regex }, { phone: regex }];
    }

    const query = Donor.find(filter);
    const total = await Donor.countDocuments(query.getFilter());
    const donors = await query
      .sort(sort)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    return res.json({
      total,
      page: Number(page),
      limit: Number(limit),
      donors: donors.map(sanitize),
    });
  } catch (err) {
    console.error("listDonors error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/donors/:id
export const getDonorById = async (req, res) => {
  try {
    const { id } = req.params;
    const donor = await Donor.findById(id);
    if (!donor) return res.status(404).json({ message: "Donor not found" });
    return res.json({ donor: sanitize(donor) });
  } catch (err) {
    console.error("getDonorById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PATCH /api/donors/:id
// Demographic/medical updates ONLY. Status changes must use acceptDonor().
export const updateDonorById = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Donor.findById(id);
    if (!existing) return res.status(404).json({ message: "Donor not found" });

    const {
      name,
      nic,
      email,
      phone,
      dateOfBirth,
      gender,
      bloodGroup,
      weightKg,
      addressLine1,
      city,
      district,
      nearestHospitalId,
      medical,
      confirmation, // 🚫 not allowed here anymore
    } = req.body;

    // Block status edits here — enforce acceptDonor endpoint
    if (confirmation !== undefined) {
      return res
        .status(400)
        .json({ message: "Use /api/donors/:id/accept to update donor status" });
    }

    if (name !== undefined) existing.name = name;
    if (nic !== undefined) existing.nic = String(nic).toUpperCase().trim();
    if (email !== undefined) existing.email = String(email).toLowerCase().trim();
    if (phone !== undefined) existing.phone = phone;
    if (dateOfBirth !== undefined) existing.dateOfBirth = dateOfBirth;
    if (gender !== undefined) existing.gender = gender;
    if (bloodGroup !== undefined) existing.bloodGroup = bloodGroup;
    if (weightKg !== undefined) existing.weightKg = weightKg;
    if (addressLine1 !== undefined) existing.addressLine1 = addressLine1;
    if (city !== undefined) existing.city = city;
    if (district !== undefined) existing.district = district;

    if (nearestHospitalId !== undefined) {
      const hospitalExists = await Hospital.exists({ _id: nearestHospitalId });
      if (!hospitalExists) {
        return res.status(400).json({ message: "nearestHospitalId is invalid" });
      }
      existing.nearestHospitalId = nearestHospitalId;
    }

    if (medical !== undefined && typeof medical === "object") {
      if (medical.lastDonationDate !== undefined)
        existing.medical.lastDonationDate = medical.lastDonationDate || null;
      if (medical.chronicIllness !== undefined)
        existing.medical.chronicIllness = !!medical.chronicIllness;
      if (medical.medications !== undefined)
        existing.medical.medications = medical.medications || "";
      if (medical.recentTattooMonths !== undefined)
        existing.medical.recentTattooMonths = Number(medical.recentTattooMonths || 0);
    }

    const saved = await existing.save();
    return res.json({ message: "Donor updated", donor: sanitize(saved) });
  } catch (err) {
    if (err?.code === 11000) {
      const fields = Object.keys(err.keyPattern || {});
      return res.status(409).json({ message: `Duplicate value for: ${fields.join(", ")}` });
    }
    console.error("updateDonorById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/donors/:id
export const deleteDonorById = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Donor.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Donor not found" });
    return res.json({ message: "Donor deleted" });
  } catch (err) {
    console.error("deleteDonorById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// PATCH /api/donors/:id/accept
// Only admin/hospital can set status to Confirmed or Rejected (from Pending).
export const acceptDonor = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};


    // Validate input
    if (!["Confirmed", "Rejected"].includes(status)) {
      return res
        .status(400)
        .json({ message: "status must be either 'Confirmed' or 'Rejected'" });
    }

    const donor = await Donor.findById(id);
    if (!donor) return res.status(404).json({ message: "Donor not found" });

    // Only allow transition from Pending
    if (donor.confirmation.status !== "Pending") {
      return res.status(409).json({
        message: `Cannot change status from '${donor.confirmation.status}'. Only Pending donors can be confirmed/rejected.`,
      });
    }

    donor.confirmation.status = status;
    donor.confirmation.confirmedAt = new Date();
    donor.confirmation.confirmedById = req.user?.id || null;

    await donor.save();
    return res.json({
      message: `Donor ${status.toLowerCase()}`,
      donor: sanitize(donor),
    });
  } catch (err) {
    console.error("acceptDonor error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
