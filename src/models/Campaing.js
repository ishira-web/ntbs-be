import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    hospitalName: { type: String, required: true},
    title: { type: String, required: true, trim: true },
    organization: { type: String, trim: true },
    status: { type: String, enum: ["planned", "ongoing", "completed", "cancelled"], default: "planned", index: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    venue: { type: String, trim: true },
    posterImg: { type: String, trim: true },
    locationUrl: { type: String, trim: true },
  }
)

export default mongoose.model("Campaign", campaignSchema);
