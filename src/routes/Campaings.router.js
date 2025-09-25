// server/routes/campaign.routes.js
import { Router } from "express";
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
} from "../controllers/Campaings.controller.js";
import { uploadPoster } from "../configs/upload.js";

const router = Router();

// Create (multipart/form-data with field: poster)
router.post("/", uploadPoster, createCampaign);

// List + filters
router.get("/", getCampaigns);

// Get one
router.get("/:id", getCampaignById);

// Update (multipart optional: poster)
router.patch("/:id", uploadPoster, updateCampaign);

// Delete
router.delete("/:id", deleteCampaign);

export default router;
