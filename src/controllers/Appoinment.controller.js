import mongoose from "mongoose";
import Appointment, { APPOINTMENT_SLOTS } from "../models/Appoinment.js";
import Donor from "../models/Donor.js";

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const toDayUTC = (yyyy_mm_dd) => new Date(`${yyyy_mm_dd}T00:00:00.000Z`);
const dayKeyFromDate = (d) => d.toISOString().slice(0, 10);
const isWeekday = (d) => {
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  return day >= 1 && day <= 5;
};
const COOL_DOWN_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

// Create (book) appointment — confirmed donors only; weekdays; allowed slots; cooldown 2 days
export const createAppointment = async (req, res) => {
  try {
    const { hospitalId, donorId, date, slot, note = "" } = req.body || {};
    if (!hospitalId || !donorId || !date || !slot) {
      return res.status(400).json({ message: "hospitalId, donorId, date (YYYY-MM-DD), slot are required" });
    }
    if (!isId(hospitalId) || !isId(donorId)) {
      return res.status(400).json({ message: "Invalid hospitalId or donorId" });
    }
    if (![APPOINTMENT_SLOTS.SLOT1, APPOINTMENT_SLOTS.SLOT2].includes(slot)) {
      return res.status(400).json({ message: "slot must be SLOT1 (10:00-11:30) or SLOT2 (12:00-13:30)" });
    }

    // Confirm donor is confirmed
    const donor = await Donor.findById(donorId);
    if (!donor) return res.status(404).json({ message: "Donor not found" });
    if (donor.confirmation?.status !== "Confirmed") {
      return res.status(403).json({ message: "Only confirmed donors can book appointments" });
    }

    // Normalize date to UTC midnight & check weekday
    const day = toDayUTC(date);
    if (Number.isNaN(+day)) return res.status(400).json({ message: "Invalid date format (use YYYY-MM-DD)" });
    if (!isWeekday(day)) return res.status(400).json({ message: "Appointments allowed on weekdays only" });
    const dayKey = dayKeyFromDate(day);

    // Cooldown: donor can't have another appointment within +/- 2 days (Pending or Approved)
    const from = new Date(day.getTime() - COOL_DOWN_MS);
    const to = new Date(day.getTime() + COOL_DOWN_MS);
    const clash = await Appointment.findOne({
      donorId,
      day: { $gte: from, $lte: to },
      status: { $in: ["Pending", "Approved"] },
    });
    if (clash) {
      return res.status(409).json({ message: "Cooldown: donor may book only one appointment within 2 days" });
    }

    // Create
    const appt = await Appointment.create({
      hospitalId,
      donorId,
      day,
      dayKey,
      slot,
      status: "Pending",
      note,
    });

    return res.status(201).json({ message: "Appointment created", appointment: appt });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "This hospital/day/slot is already fully booked" });
    }
    console.error("createAppointment error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Approve appointment — admin or hospital (only its own)
export const approveAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: "Invalid appointment id" });
    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    // role checks (expects req.user from your protect middleware)
    const role = req.user?.role;
    if (!["admin", "hospital"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (role === "hospital" && String(req.user.hospitalId) !== String(appt.hospitalId)) {
      return res.status(403).json({ message: "Hospital can only approve its own appointments" });
    }

    if (appt.status === "Approved") {
      return res.json({ message: "Already approved", appointment: appt });
    }
    if (appt.status === "Cancelled") {
      return res.status(400).json({ message: "Cannot approve a cancelled appointment" });
    }

    appt.status = "Approved";
    await appt.save();
    return res.json({ message: "Appointment approved", appointment: appt });
  } catch (err) {
    console.error("approveAppointment error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Delete/cancel — donor can cancel their own; admin/hospital can also cancel
export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: "Invalid appointment id" });
    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ message: "Appointment not found" });

    const role = req.user?.role;
    const requesterDonorId = req.user?.donorId || req.user?.id; // support either token shape
    const isOwnerDonor = role === "donor" && String(appt.donorId) === String(requesterDonorId);

    if (!(isOwnerDonor || role === "admin" || (role === "hospital" && String(req.user.hospitalId) === String(appt.hospitalId)))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (appt.status === "Cancelled") {
      return res.json({ message: "Already cancelled", appointment: appt });
    }

    appt.status = "Cancelled";
    await appt.save();
    return res.json({ message: "Appointment cancelled", appointment: appt });
  } catch (err) {
    console.error("deleteAppointment error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get all appointments (filters + pagination)
export const listAppointments = async (req, res) => {
  try {
    const {
      hospitalId,
      donorId,
      status,
      from, // YYYY-MM-DD optional
      to,   // YYYY-MM-DD optional
      page = 1,
      limit = 10,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (hospitalId) {
      if (!isId(hospitalId)) return res.status(400).json({ message: "Invalid hospitalId" });
      filter.hospitalId = hospitalId;
    }
    if (donorId) {
      if (!isId(donorId)) return res.status(400).json({ message: "Invalid donorId" });
      filter.donorId = donorId;
    }
    if (status) filter.status = status;

    if (from || to) {
      const gte = from ? toDayUTC(from) : new Date("1970-01-01T00:00:00.000Z");
      const lte = to ? toDayUTC(to) : new Date("2999-12-31T00:00:00.000Z");
      filter.day = { $gte: gte, $lte: lte };
    }

    // hospitals see their own by default if no filter passed
    if (req.user?.role === "hospital" && !filter.hospitalId) {
      filter.hospitalId = req.user.hospitalId;
    }

    const q = Appointment.find(filter)
      .populate({ path: "donorId", select: "name bloodGroup" })
      .populate({ path: "hospitalId", select: "name district" });

    const total = await Appointment.countDocuments(q.getFilter());
    const rows = await q.sort(sort).skip((Number(page) - 1) * Number(limit)).limit(Number(limit));

    return res.json({ total, page: Number(page), limit: Number(limit), appointments: rows });
  } catch (err) {
    console.error("listAppointments error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get all pending appointments (helper)
export const listPendingAppointments = async (req, res) => {
  req.query.status = "Pending";
  return listAppointments(req, res);
};
