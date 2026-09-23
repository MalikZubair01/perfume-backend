import express from "express";
import { verifyToken, isAdmin } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getStats,
} from "../controllers/productController.js";

const router = express.Router();

// ---- PUBLIC ----
router.get("/", getProducts); // GET /api/products?search=&category=&type=&badge=&minPrice=&maxPrice=&inStock=&sort=&page=&limit=

// ---- ADMIN ONLY (must come before "/:slug" so it isn't swallowed by it) ----
router.get("/stats/summary", verifyToken, isAdmin, getStats);
router.post("/", verifyToken, isAdmin, upload.array("images", 5), createProduct);
router.put("/:id", verifyToken, isAdmin, upload.array("images", 5), updateProduct);
router.delete("/:id", verifyToken, isAdmin, deleteProduct);
router.patch("/:id/stock", verifyToken, isAdmin, adjustStock);

// ---- PUBLIC (kept last: catches /:slug for product detail) ----
router.get("/:slug", getProductBySlug); // GET /api/products/royal-oud

export default router;
