// server/models/Appointment.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

export const APPOINTMENT_SLOTS = {
  SLOT1: "SLOT1", // 10:00 - 11:30
  SLOT2: "SLOT2", // 12:00 - 13:30
};

const AppointmentSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    donorId: { type: Schema.Types.ObjectId, ref: "Donor", required: true, index: true },

    // Store the day (date-only). Controller will normalize to UTC midnight.
    day: { type: Date, required: true, index: true },
    // String key YYYY-MM-DD to avoid timezone issues in unique index
    dayKey: { type: String, required: true },

    slot: {
      type: String,
      enum: Object.values(APPOINTMENT_SLOTS),
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Cancelled"],
      default: "Pending",
      index: true,
    },

    purpose: { type: String, default: "BloodDonation", immutable: true },
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

// One appointment per hospital/day/slot
AppointmentSchema.index({ hospitalId: 1, dayKey: 1, slot: 1 }, { unique: true });

// One donor appointment per day+slot naturally enforced by cooldown in controller.
// Optional helpful index:
AppointmentSchema.index({ donorId: 1, day: 1 });

const Appointment = model("Appointment", AppointmentSchema);
export default Appointment;
