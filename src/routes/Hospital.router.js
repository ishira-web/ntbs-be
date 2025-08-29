import express from "express";

import {
  createHospital,
  listHospitals,
  getHospitalById,
  deleteHospitalById,
} from "../controllers/Hospital.controller.js";


const HospitalRouter = express.Router();


HospitalRouter.post("/", createHospital);
HospitalRouter.get("/", listHospitals);
HospitalRouter.get("/:id", getHospitalById);
HospitalRouter.delete("/:id", deleteHospitalById);

export default HospitalRouter;
