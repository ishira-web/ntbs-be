import { Router } from "express";
import {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign
} from "../controllers/Campaings.controller.js";
import { uploadCampaignPoster } from "../configs/multer-campaign.js";

const router = Router();

// Serve uploaded files (once, at app-level) – see app.js section below
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

router.get("/", listCampaigns);
router.get("/:id", getCampaign);

// Expect multipart/form-data with field `poster` for the image
router.post("/", uploadCampaignPoster, createCampaign);
router.put("/:id", uploadCampaignPoster, updateCampaign);
router.delete("/:id", deleteCampaign);

export default router;
