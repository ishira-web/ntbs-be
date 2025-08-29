import express from "express";
import {
  createDonor,
  listDonors,
  getDonorById,
  updateDonorById,
  deleteDonorById,
} from "../controllers/Donor.controller.js";

const DonorRouter = express.Router();

// Create donor (donor self-register or hospital/admin on behalf)
DonorRouter.post("/",  createDonor);

// Admin & Hospital can view all donors
DonorRouter.get("/", listDonors);

// Get donor by id: donor can view self, admin/hospital can view any
DonorRouter.get("/:id", getDonorById);

// Update donor: donor can edit own info; hospital/admin can edit and confirm
DonorRouter.patch("/:id", updateDonorById);

// Delete donor: typically admin only
DonorRouter.delete("/:id", deleteDonorById);

export default DonorRouter;
