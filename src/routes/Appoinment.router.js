// server/routes/Appointment.router.js
import { Router } from "express";
import {
  createAppointment,
  approveAppointment,
  deleteAppointment,
  listAppointments,
  listPendingAppointments,
} from "../controllers/Appoinment.controller.js";

const router = Router();

// Create (confirmed donors only) — donor/hospital/admin can create
router.post("/",  createAppointment);

// Approve — hospital (own) or admin
router.patch("/:id/approve", approveAppointment);

// Delete/Cancel — donor owns OR hospital (own) OR admin
router.delete("/:id",  deleteAppointment);

// View — all & pending (with filters)
router.get("/", listAppointments);
router.get("/pending", listPendingAppointments);

export default router;
