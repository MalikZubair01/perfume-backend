import Product from "../models/Product.js";
import Category from "../models/Category.js";
import cloudinary from "../config/cloudinary.js";
import slugify from "../utils/slugify.js";
import asyncHandler from "../utils/asyncHandler.js";

// @route   GET /api/products
// @desc    Get all perfumes — pagination + search + filters
// @query   search      free-text search across name/type/desc
// @query   category    category slug or id
// @query   type        legacy free-text type filter
// @query   badge       e.g. "Best Seller", "New"
// @query   minPrice, maxPrice
// @query   inStock     "true" to only show stock > 0
// @query   sort        "price_asc" | "price_desc" | "newest" | "rating" (default: newest)
// @query   page, limit  pagination (default page=1, limit=12)
// @access  Public
export const getProducts = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    type,
    badge,
    minPrice,
    maxPrice,
    inStock,
    sort = "newest",
    page = 1,
    limit = 12,
  } = req.query;

  const filter = {};

  if (search) filter.$text = { $search: search };
  if (type) filter.type = type;
  if (badge) filter.badge = badge;
  if (inStock === "true") filter.stock = { $gt: 0 };

  if (category) {
    // accept either a category slug or a raw ObjectId
    if (category.match(/^[0-9a-fA-F]{24}$/)) {
      filter.category = category;
    } else {
      const cat = await Category.findOne({ slug: category });
      // if the slug doesn't resolve to a real category, force an empty result
      filter.category = cat ? cat._id : null;
    }
  }

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const sortMap = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    rating: { rating: -1 },
    newest: { createdAt: -1 },
  };
  const sortBy = sortMap[sort] || sortMap.newest;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Number(limit));
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort(sortBy)
      .skip(skip)
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
    hasNextPage: pageNum * limitNum < total,
    hasPrevPage: pageNum > 1,
    products,
  });
});

// @route   GET /api/products/:slug
// @desc    Product detail — by slug (preferred, SEO-friendly) or Mongo _id
// @access  Public
export const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const product = await Product.findOne({
    $or: [{ slug }, { _id: slug.match(/^[0-9a-fA-F]{24}$/) ? slug : null }],
  }).populate("category", "name slug");

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // simple related-products list: same category, excluding this product
  const related = await Product.find({
    category: product.category?._id,
    _id: { $ne: product._id },
  })
    .limit(4)
    .select("name slug price images rating");

  res.status(200).json({ success: true, product, related });
});

// @route   POST /api/products
// @desc    Create a new perfume (admin). Images already uploaded to Cloudinary
//          by uploadMiddleware -> available on req.files
// @access  Private/Admin
export const createProduct = asyncHandler(async (req, res) => {
  const { name, type, category, price, badge, rating, stock, sizes, desc, notes } = req.body;

  if (!name || !price || !category) {
    res.status(400);
    throw new Error("Name, price and category are required");
  }

  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) {
    res.status(400);
    throw new Error("Invalid category");
  }

  let slug = slugify(name);
  const slugExists = await Product.findOne({ slug });
  if (slugExists) slug = `${slug}-${Date.now()}`;

  const images = (req.files || []).map((file) => ({
    url: file.path, // secure Cloudinary URL
    public_id: file.filename, // Cloudinary public_id, needed for later deletion
  }));

  const product = await Product.create({
    slug,
    name,
    type,
    category,
    price,
    badge: badge || null,
    rating,
    stock: stock ?? 0,
    sizes: sizes ? JSON.parse(sizes) : undefined, // sizes/notes arrive as JSON strings in multipart form-data
    desc,
    notes: notes ? JSON.parse(notes) : undefined,
    images,
  });

  res.status(201).json({ success: true, product });
});

// @route   PUT /api/products/:id
// @desc    Update a perfume. New images (if any) are appended; pass
//          removeImageIds (JSON array string) in body to delete specific existing images.
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const {
    name,
    type,
    category,
    price,
    badge,
    rating,
    stock,
    sizes,
    desc,
    notes,
    removeImageIds,
  } = req.body;

  if (name && name !== product.name) {
    let newSlug = slugify(name);
    const clash = await Product.findOne({ slug: newSlug, _id: { $ne: product._id } });
    if (clash) newSlug = `${newSlug}-${Date.now()}`;
    product.slug = newSlug;
    product.name = name;
  }

  if (category !== undefined) {
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      res.status(400);
      throw new Error("Invalid category");
    }
    product.category = category;
  }

  if (type !== undefined) product.type = type;
  if (price !== undefined) product.price = price;
  if (badge !== undefined) product.badge = badge;
  if (rating !== undefined) product.rating = rating;
  if (stock !== undefined) product.stock = stock;
  if (sizes !== undefined) product.sizes = JSON.parse(sizes);
  if (desc !== undefined) product.desc = desc;
  if (notes !== undefined) product.notes = JSON.parse(notes);

  // remove selected existing images from Cloudinary + from the product
  if (removeImageIds) {
    const idsToRemove = JSON.parse(removeImageIds); // array of public_id
    await Promise.all(idsToRemove.map((public_id) => cloudinary.uploader.destroy(public_id)));
    product.images = product.images.filter((img) => !idsToRemove.includes(img.public_id));
  }

  // append newly uploaded images
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map((file) => ({
      url: file.path,
      public_id: file.filename,
    }));
    product.images.push(...newImages);
  }

  await product.save();
  res.status(200).json({ success: true, product });
});

// @route   DELETE /api/products/:id
// @desc    Delete a perfume + its Cloudinary images
// @access  Private/Admin
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  if (product.images.length > 0) {
    await Promise.all(product.images.map((img) => cloudinary.uploader.destroy(img.public_id)));
  }

  await product.deleteOne();
  res.status(200).json({ success: true, message: "Product deleted" });
});

// @route   PATCH /api/products/:id/stock
// @desc    Increase/decrease stock, e.g. { "delta": -1 } or { "delta": 10 }
// @access  Private/Admin
export const adjustStock = asyncHandler(async (req, res) => {
  const { delta } = req.body;
  if (delta === undefined) {
    res.status(400);
    throw new Error("delta is required, e.g. { delta: -1 }");
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  product.stock = Math.max(0, product.stock + Number(delta));
  await product.save();

  res.status(200).json({ success: true, product });
});

// @route   GET /api/products/stats/summary
// @desc    Dashboard stats for admin
// @access  Private/Admin
export const getStats = asyncHandler(async (req, res) => {
  const [totalProducts, stockAgg, lowStockCount, outOfStockCount, totalCategories] =
    await Promise.all([
      Product.countDocuments(),
      Product.aggregate([{ $group: { _id: null, totalStock: { $sum: "$stock" } } }]),
      Product.countDocuments({ stock: { $gt: 0, $lte: 5 } }),
      Product.countDocuments({ stock: 0 }),
      Category.countDocuments(),
    ]);

  res.status(200).json({
    success: true,
    stats: {
      totalProducts,
      totalStock: stockAgg[0]?.totalStock || 0,
      lowStockCount,
      outOfStockCount,
      totalCategories,
    },
  });
});
