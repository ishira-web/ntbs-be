// routes/campaignRoutes.js
import { Router } from "express";
import {
  uploadPoster,
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
} from "../controllers/Campaings.controller.js";

const router = Router();

// Create with optional poster file (form field name: "poster")
router.post("/", uploadPoster, createCampaign);

// List / Get
router.get("/", listCampaigns);
router.get("/:id", getCampaign);

// Update (can also replace poster)
router.put("/:id", uploadPoster, updateCampaign);

// Delete
router.delete("/:id", deleteCampaign);

export default router;
