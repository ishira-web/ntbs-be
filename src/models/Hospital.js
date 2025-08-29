import mongoose from "mongoose";

const LogoSchema = new mongoose.Schema(
  {
    data: { type: String, default: null },       
    mimeType: { type: String, default: null },   
    sizeBytes: { type: Number, default: 0 },
  },
  { _id: false }
);

const HospitalSchema = new mongoose.Schema(
  {
    hospitalCode: {
      type: String,
      required: true,
      unique: true,            
      index: true,
    },
    name: { type: String, required: true, trim: true, },
    district: { type: String, required: true, trim: true,},
    address: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true ,unique:true,required:true},
    password : {type :String ,required:true},
    phone: { type: String, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    role : {type:String,default:"hospital"},
    logo: { type: LogoSchema, default: () => ({}) },
  },
  { timestamps: true }
);

HospitalSchema.index({ name: "text", district: "text" });

const Hospital = mongoose.model("Hospital", HospitalSchema);
export default Hospital;
