import mongoose from "mongoose";

const AdminSchema = mongoose.Schema({
adminId: { type: String, required: true, unique: true, default: function() { return `#ADM${Math.floor(1000 + Math.random() * 9000)}` } },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' },
})

const Admin = mongoose.model("Admin",AdminSchema);
export default Admin;