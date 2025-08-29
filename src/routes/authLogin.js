import express from 'express'
import {login} from '../Authlogin/authcontroller.js'

const authRouter = express.Router();

authRouter.post('/login',login);

export default authRouter;
