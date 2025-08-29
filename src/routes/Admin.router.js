import express from "express";
import {
  createAdmin,
  listAdmins,
  getAdminById,
  updateAdminById,
  deleteAdminById,
} from "../controllers/Admin.controller.js";
import { protect } from "../middleware/protect.js";

const router = express.Router();

router.post("/",protect(["admin"]), createAdmin);
router.get("/", listAdmins);
router.get("/:id", getAdminById);
router.patch("/:id", updateAdminById);
router.delete("/:id", deleteAdminById);

export default router;
