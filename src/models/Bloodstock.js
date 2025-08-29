import mongoose from "mongoose";

const { Schema, model } = mongoose;

export const COMPONENTS = ["WholeBlood", "RBC", "Plasma", "Platelets", "Cryo"];

const DEFAULT_SHELF_LIFE_DAYS = {
  WholeBlood: 35,  
  RBC: 42,
  Plasma: 365,     
  Platelets: 5,
  Cryo: 365
};

const BatchSchema = new Schema(
  {
    units: { type: Number, required: true, min: 1 },
    collectedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }, // auto-filled if omitted (see hook)
    note: { type: String, trim: true, default: "" }
  },
  { _id: true }
);

// Auto-calc expiresAt from collectedAt + shelf life if not provided
BatchSchema.pre("validate", function (next) {
  if (!this.expiresAt) {
    const parent = this.ownerDocument?.();
    const comp = parent?.component || "WholeBlood";
    const days = DEFAULT_SHELF_LIFE_DAYS[comp] ?? 30;
    const base = this.collectedAt || new Date();
    this.expiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  }
  next();
});

const BloodStockSchema = new Schema(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      required: true,
      index: true,
    },
    component: {
      type: String,
      enum: COMPONENTS,
      required: true,
      index: true,
    },
    batches: { type: [BatchSchema], default: [] }, // each batch has its own expiry
  },
  { timestamps: true }
);

// One doc per hospital + group + component
BloodStockSchema.index({ hospitalId: 1, bloodGroup: 1, component: 1 }, { unique: true });

// Convenience virtuals
BloodStockSchema.virtual("totalUnits").get(function () {
  return (this.batches || []).reduce((sum, b) => sum + (b.units || 0), 0);
});

BloodStockSchema.virtual("earliestExpiry").get(function () {
  const dates = (this.batches || []).map((b) => b.expiresAt).filter(Boolean);
  return dates.length ? new Date(Math.min(...dates.map((d) => +new Date(d)))) : null;
});

// Small helpers
BloodStockSchema.methods.addBatch = function ({ units, collectedAt, expiresAt, note }) {
  this.batches.push({ units, collectedAt, expiresAt, note });
  return this;
};

BloodStockSchema.methods.removeExpired = function (at = new Date()) {
  this.batches = (this.batches || []).filter((b) => new Date(b.expiresAt) > at);
  return this;
};

const BloodStock = model("BloodStock", BloodStockSchema);
export default BloodStock;
