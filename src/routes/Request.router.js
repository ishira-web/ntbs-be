import { Router } from "express";
import {
  createRequest,
  listRequests,
  getRequestById,
  approveRequest,
  rejectRequest,
  cancelRequest,
  fulfillRequest,
  deleteRequest,
} from "../controllers/Request.controller.js";


const router = Router();

// Create a request (hospital or admin)
router.post("/", createRequest);

// View
router.get("/", listRequests);
router.get("/:id", getRequestById);

// Approve (admin or source hospital) — sets sourceHospitalId and checks availability
router.patch("/:id/approve", approveRequest);

// Reject (admin, or hospital if it's source/destination)
router.patch("/:id/reject",rejectRequest);

// Cancel (destination hospital only when Pending)
router.patch("/:id/cancel",cancelRequest);

// Fulfill (transfer stock from source -> destination)
router.patch("/:id/fulfill",fulfillRequest);

// Delete (admin only)
router.delete("/:id",deleteRequest);

export default router;
