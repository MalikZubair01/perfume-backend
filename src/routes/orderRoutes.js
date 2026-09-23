import express from "express";
import { verifyToken, isAdmin } from "../middleware/authMiddleware.js";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrderStats,
} from "../controllers/orderController.js";

const router = express.Router();

// ---- PUBLIC (guest checkout — no login required) ----
router.post("/", createOrder);

// ---- ADMIN ONLY ----
router.get("/", verifyToken, isAdmin, getOrders);
router.get("/stats/summary", verifyToken, isAdmin, getOrderStats);
router.get("/:id", verifyToken, isAdmin, getOrderById);
router.patch("/:id/status", verifyToken, isAdmin, updateOrderStatus);

export default router;
