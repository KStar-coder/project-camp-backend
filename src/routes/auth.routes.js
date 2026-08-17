import { Router } from "express";
import { login, registerUser } from "../controllers/auth.controller.js";
const router = Router()
import { validate } from "../middlewares/validator.middleware.js";
import { userRegisterValidator } from '../validators/index.js'

// we collect all the errors by executing the userRegisterValidator() function 
// Then we pass it onto the validate middleware. We do not execute it as we make it act like a middleware that takes on the errors and throws new ApiError if there's any error
// Finally, when there is no error, registerUser controller is called.
router.route("/register").post(userRegisterValidator(), validate, registerUser);
router.route("/login").post(login);

export default router;