import express from "express";
import { signup, login, forgotPassword, resetPassword, getMe } from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// ---- Public ----
router.post("/signup", signup);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);

// ---- Protected ----
router.get("/me", verifyToken, getMe);

export default router;
