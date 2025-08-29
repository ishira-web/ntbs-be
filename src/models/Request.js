import mongoose from "mongoose";

const { Schema, model } = mongoose;

const RequestSchema = new Schema(
  {
    requestID: {
      type: String,
      required: true,
      unique: true,
      default() {
        return `#REQ${Math.floor(1000 + Math.random() * 9000)}`;
      },
      index: true,
    },

    // Destination (requesting) hospital
    hospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },

    // What is being requested
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      required: true,
      index: true,
    },
    component: {
      type: String,
      enum: ["WholeBlood", "RBC", "Plasma", "Platelets", "Cryo"],
      required: true,
      index: true,
    },
    units: { type: Number, required: true, min: 1 },

    // Workflow
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Fulfilled", "Cancelled"],
      default: "Pending",
      index: true,
    },
    preferredDate: { type: Date, default: null },
    note: { type: String, trim: true, default: "" },

    // Approval (who will supply it)
    sourceHospitalId: { type: Schema.Types.ObjectId, ref: "Hospital", default: null },
    approvedAt: { type: Date, default: null },
    approvedByRole: { type: String, default: null }, // "admin" | "hospital"
    approvedById: { type: Schema.Types.ObjectId, default: null },

    // Fulfilment
    fulfilledAt: { type: Date, default: null },
    fulfilledByRole: { type: String, default: null },
    fulfilledById: { type: Schema.Types.ObjectId, default: null },

    // Audit of who created it (optional, set from JWT)
    createdByRole: { type: String, default: null },
    createdById: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

export default model("Request", RequestSchema);
