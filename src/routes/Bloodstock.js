// server/routes/BloodStock.router.js
import { Router } from "express";
import {
  addBloodStock,
  listBloodStocks,
  getBloodStockById,
  updateBloodBatch,
  deleteBloodBatch,
  deleteBloodStock,
  getBloodStockSummary,
  getUnits,
} from "../controllers/Bloodstock.controller.js";
import { protect } from "../middleware/protect.js";


const brouter = Router();

// Create / add batches
brouter.post("/", addBloodStock);

// View
brouter.get("/", listBloodStocks);
brouter.get("/summary", getBloodStockSummary);
brouter.get("/:id", getBloodStockById);

// Update specific batch
brouter.patch("/:stockId/batches/:batchId",updateBloodBatch);

// Delete batch or entire stock
brouter.delete("/:stockId/batches/:batchId",deleteBloodBatch);
brouter.delete("/:id",deleteBloodStock);
brouter.get("/units",protect(["hospital"]), getUnits);
export default brouter;
