import express from "express";
import { verifyToken, isAdmin } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";

const router = express.Router();

// ---- PUBLIC ----
router.get("/", getCategories); // GET /api/categories

// ---- ADMIN ONLY ----
router.post("/", verifyToken, isAdmin, upload.single("image"), createCategory);
router.put("/:id", verifyToken, isAdmin, upload.single("image"), updateCategory);
router.delete("/:id", verifyToken, isAdmin, deleteCategory);

// ---- PUBLIC (kept last so "/:id"-style admin routes above aren't shadowed) ----
router.get("/:slug", getCategoryBySlug); // GET /api/categories/attar

export default router;
