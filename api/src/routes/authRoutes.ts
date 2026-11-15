import { Router } from "express";
import { signup, login, me } from "../controllers/authController";
import { googleCallback, googleStart, microsoftCallback, microsoftStart, requestCode, signInMethods, verifyCode } from "../controllers/campusController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/campus/request-code", requestCode);
router.post("/campus/verify", verifyCode);
router.get("/campus/methods", signInMethods);
router.get("/campus/google/start", googleStart);
router.post("/campus/google/callback", googleCallback);
router.get("/campus/microsoft/start", microsoftStart);
router.post("/campus/microsoft/callback", microsoftCallback);
router.get("/me", authenticateToken, me);

export default router;
