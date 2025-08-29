import mongoose from "mongoose";

const DonorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nic: { type: String, required: true, unique: true, uppercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password:{type:String,required:true},
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      required: true,
    },
    weightKg: { type: Number, required: true, min: 40 },

    addressLine1: { type: String, default: "" },
    city: { type: String, default: "" },
    district: { type: String, required: true },

    nearestHospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },

    medical: {
      lastDonationDate: { type: Date, default: null },
      chronicIllness: { type: Boolean, default: false },
      medications: { type: String, default: "" },
      recentTattooMonths: { type: Number, default: 0 },
    },

    confirmation: {
      status: { type: String, enum: ["Pending", "Confirmed", "Rejected"], default: "Pending", index: true },
      confirmedAt: { type: Date, default: null },
      confirmedByRole: { type: String, default: null }, // "hospital" | "admin"
      confirmedById: { type: mongoose.Schema.Types.ObjectId, default: null },
    },

    role: { type: String, default: "donor", immutable: true },
  },
  { timestamps: true }
);

export default mongoose.model("Donor", DonorSchema);
