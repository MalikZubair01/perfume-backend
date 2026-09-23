import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import asyncHandler from "../utils/asyncHandler.js";
import { generateOrderNumber } from "../utils/slugify.js";

const DELIVERY_CHARGE = 250;
const FREE_DELIVERY_THRESHOLD = 5000;

// @route   POST /api/orders
// @desc    Place an order — no login required (guest checkout).
//          Validates stock, decrements it atomically, snapshots product
//          details onto the order so it stays accurate even if the
//          product is edited/deleted later.
// @access  Public
export const createOrder = asyncHandler(async (req, res) => {
  const { customer, items, paymentMethod } = req.body;

  if (!customer) {
    res.status(400);
    throw new Error("Customer details are required");
  }
  const required = ["fullName", "mobile", "email", "address", "city", "postalCode"];
  const missing = required.filter((f) => !customer[f]);
  if (missing.length) {
    res.status(400);
    throw new Error(`Missing customer field(s): ${missing.join(", ")}`);
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error("Order must contain at least one item");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const orderItems = [];
    let itemsSubtotal = 0;

    for (const line of items) {
      const { productId, size, quantity } = line;
      if (!productId || !quantity || quantity < 1) {
        throw new Error("Each item needs a productId and a quantity of at least 1");
      }

      // product may be identified by slug or Mongo _id (cart stores slug)
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(productId);
      const query = isObjectId ? { _id: productId } : { slug: productId };

      // atomic: only decrements if enough stock is available right now,
      // preventing two simultaneous orders from overselling the same item
      const updatedProduct = await Product.findOneAndUpdate(
        { ...query, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true, session }
      );

      if (!updatedProduct) {
        // either the product doesn't exist, or there isn't enough stock left
        const existing = await Product.findOne(query).session(session);
        if (!existing) {
          throw new Error(`Product not found: ${productId}`);
        }
        throw new Error(
          `Not enough stock for "${existing.name}" (only ${existing.stock} left)`
        );
      }

      const unitPrice = updatedProduct.price;
      itemsSubtotal += unitPrice * quantity;

      orderItems.push({
        product: updatedProduct._id,
        name: updatedProduct.name,
        image: updatedProduct.images?.[0]?.url || null,
        size: size || null,
        price: unitPrice,
        quantity,
      });
    }

    const deliveryCharge = itemsSubtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;
    const total = itemsSubtotal + deliveryCharge;

    const [order] = await Order.create(
      [
        {
          orderNumber: generateOrderNumber(),
          customer: {
            fullName: customer.fullName,
            mobile: customer.mobile,
            email: customer.email,
            address: customer.address,
            city: customer.city,
            postalCode: customer.postalCode,
            notes: customer.notes || "",
          },
          items: orderItems,
          itemsSubtotal,
          deliveryCharge,
          total,
          paymentMethod: paymentMethod === "jazzcash" ? "jazzcash" : "cod",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    res.status(201).json({ success: true, order });
  } catch (err) {
    await session.abortTransaction();
    res.status(err.status || 400);
    throw err;
  } finally {
    session.endSession();
  }
});

// @route   GET /api/orders
// @desc    List all orders — pagination + status filter + search (name/email/mobile/orderNumber)
// @access  Private/Admin
export const getOrders = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const re = new RegExp(search.trim(), "i");
    filter.$or = [
      { orderNumber: re },
      { "customer.fullName": re },
      { "customer.email": re },
      { "customer.mobile": re },
    ];
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Number(limit));
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Order.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
    orders,
  });
});

// @route   GET /api/orders/:id
// @desc    Single order by Mongo _id or orderNumber
// @access  Private/Admin
export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);

  const order = await Order.findOne(isObjectId ? { _id: id } : { orderNumber: id });
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  res.status(200).json({ success: true, order });
});

// @route   PATCH /api/orders/:id/status
// @desc    Update order status
// @access  Private/Admin
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

  if (!validStatuses.includes(status)) {
    res.status(400);
    throw new Error(`Status must be one of: ${validStatuses.join(", ")}`);
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // if cancelling an order that hadn't already been cancelled, restock the items
  if (status === "Cancelled" && order.status !== "Cancelled") {
    await Promise.all(
      order.items.map((item) =>
        Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } })
      )
    );
  }

  order.status = status;
  await order.save();

  res.status(200).json({ success: true, order });
});

// @route   GET /api/orders/stats/summary
// @desc    Quick order stats for the dashboard
// @access  Private/Admin
export const getOrderStats = asyncHandler(async (req, res) => {
  const [totalOrders, pendingCount, revenueAgg] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ status: "Pending" }),
    Order.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
    ]),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      totalOrders,
      pendingCount,
      totalRevenue: revenueAgg[0]?.totalRevenue || 0,
    },
  });
});
