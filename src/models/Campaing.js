// server/models/Camp.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

/**
 * Blood Donation Camp model
 * - One camp per hospital/organizer, with date/time, location, and optional metrics.
 */

export const CAMP_STATUSES = ["planned", "scheduled", "ongoing", "completed", "cancelled"];

const LocationSchema = new Schema(
  {
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    lat: { type: Number }, // optional geo
    lng: { type: Number },
    
  },
  { _id: false }
);

const MetricsSchema = new Schema(
  {
    donorsRegistered: { type: Number, default: 0, min: 0 },
    donorsArrived: { type: Number, default: 0, min: 0 },
    donorsDeferred: { type: Number, default: 0, min: 0 },
    unitsCollected: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const CampSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    organizer: { type: String, trim: true }, // e.g., NBTS, NGO, company
    contact: {
      person: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
    },
    status: { type: String, enum: CAMP_STATUSES, default: "planned", index: true },

    // schedule
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },

    // location
    location: { type: LocationSchema, default: {} },

    // capacity planning
    expectedDonors: { type: Number, default: 0, min: 0 },
    capacity: { type: Number, default: 0, min: 0 },

    // metrics (filled after/while running)
    metrics: { type: MetricsSchema, default: {} },

    notes: { type: String, trim: true, default: "" },

    // audit
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // soft delete
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Basic sanity: endAt after startAt
CampSchema.pre("validate", function (next) {
  if (this.startAt && this.endAt && this.endAt < this.startAt) {
    return next(new Error("endAt must be after startAt"));
  }
  next();
});

// Helpful virtual
CampSchema.virtual("isActive").get(function () {
  const now = new Date();
  return this.status === "ongoing" || (this.startAt <= now && this.endAt >= now);
});

// Useful compound index for fast range/search queries
CampSchema.index({ hospitalId: 1, startAt: 1, status: 1 });

const Camp = model("Camp", CampSchema);
export default Camp;
