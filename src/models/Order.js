import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // snapshot fields — kept even if the product is later edited/deleted,
    // so old orders always show what was actually bought at the time
    name: { type: String, required: true },
    image: { type: String, default: null },
    size: { type: String, default: null },
    price: { type: Number, required: true }, // unit price at time of order
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: { type: customerSchema, required: true },
    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },

    itemsSubtotal: { type: Number, required: true },
    deliveryCharge: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },

    paymentMethod: { type: String, enum: ["cod", "jazzcash"], default: "cod" },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
      index: true,
    },
  },
  { timestamps: true }
);

orderSchema.index({ "customer.email": 1 });
orderSchema.index({ "customer.mobile": 1 });

export default mongoose.model("Order", orderSchema);
