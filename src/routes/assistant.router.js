// routes/assistant.router.js
import express from "express";
import { chatWithAssistant } from "../controllers/assistant.controller.js";

const router = express.Router();

// POST /api/assistant
router.post("/chat", chatWithAssistant);

export default router;


