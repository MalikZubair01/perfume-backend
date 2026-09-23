import Category from "../models/Category.js";
import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";
import slugify from "../utils/slugify.js";
import asyncHandler from "../utils/asyncHandler.js";

// @route   GET /api/categories
// @desc    Get all categories (public — used to build filter dropdowns/menus)
// @access  Public
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  res.status(200).json({ success: true, count: categories.length, categories });
});

// @route   GET /api/categories/:slug
// @desc    Get single category by slug or id
// @access  Public
export const getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const category = await Category.findOne({
    $or: [{ slug }, { _id: slug.match(/^[0-9a-fA-F]{24}$/) ? slug : null }],
  });

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  res.status(200).json({ success: true, category });
});

// @route   POST /api/categories
// @desc    Create a category (admin)
// @access  Private/Admin
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    res.status(400);
    throw new Error("Category name is required");
  }

  let slug = slugify(name);
  const exists = await Category.findOne({ slug });
  if (exists) {
    res.status(400);
    throw new Error("A category with this name already exists");
  }

  const image = req.file
    ? { url: req.file.path, public_id: req.file.filename }
    : { url: null, public_id: null };

  const category = await Category.create({ name, slug, description, image });
  res.status(201).json({ success: true, category });
});

// @route   PUT /api/categories/:id
// @desc    Update a category (admin)
// @access  Private/Admin
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  const { name, description, isActive } = req.body;

  if (name && name !== category.name) {
    const newSlug = slugify(name);
    const clash = await Category.findOne({ slug: newSlug, _id: { $ne: category._id } });
    if (clash) {
      res.status(400);
      throw new Error("Another category already uses this name");
    }
    category.name = name;
    category.slug = newSlug;
  }

  if (description !== undefined) category.description = description;
  if (isActive !== undefined) category.isActive = isActive;

  // replace image if a new one was uploaded
  if (req.file) {
    if (category.image?.public_id) {
      await cloudinary.uploader.destroy(category.image.public_id);
    }
    category.image = { url: req.file.path, public_id: req.file.filename };
  }

  await category.save();
  res.status(200).json({ success: true, category });
});

// @route   DELETE /api/categories/:id
// @desc    Delete a category (admin). Blocked if products still reference it.
// @access  Private/Admin
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    res.status(400);
    throw new Error(
      `Cannot delete: ${productCount} product(s) still use this category. Reassign or delete them first.`
    );
  }

  if (category.image?.public_id) {
    await cloudinary.uploader.destroy(category.image.public_id);
  }

  await category.deleteOne();
  res.status(200).json({ success: true, message: "Category deleted" });
});
