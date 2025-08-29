import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import cookieParser from "cookie-parser";
import connectDB from './mongodb/connection.js';
import DonorRouter from './routes/Donor.router.js';
import HospitalRouter from './routes/Hospital.router.js';
import router from './routes/Admin.router.js';
import brouter from './routes/Bloodstock.js';
import authRouter from './routes/authLogin.js';

dotenv.config()
const app = express();

app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());



const port =process.env.PORT || 5000

app.use("/api/donor",DonorRouter);
app.use("/api/hospital",HospitalRouter);
app.use("/api/admin",router);
app.use("/api/bloodstock",brouter);
app.use("/api",authRouter)
app.listen(port,()=>{
    connectDB();
    console.log(`Server Running on http://localhost:${port}`);
});