// server/routes/Camp.router.js
import { Router } from "express";
import {
  createCamp,
  listCamps,
  getCampById,
  updateCamp,
  deleteCamp,
  incrementMetrics,
} from "../controllers/Campaings.controller.js";

const crouter = Router();

// Create
crouter.post("/", createCamp);

// List / search should come before param routes
crouter.get("/", listCamps);

// Metrics helper (optional)
crouter.patch("/:id/metrics", incrementMetrics);

// Read / Update / Delete
crouter.get("/:id", getCampById);
crouter.patch("/:id", updateCamp);
crouter.delete("/:id", deleteCamp);

export default crouter;
