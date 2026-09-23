import mongoose from "mongoose";

const notesSchema = new mongoose.Schema(
  {
    top: { type: String, default: "" },
    heart: { type: String, default: "" },
    base: { type: String, default: "" },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true }, // needed to delete from Cloudinary later
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // human-friendly slug id, used in product detail URLs (e.g. "royal-oud")
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },

    // legacy free-text type field (kept for backward compatibility with existing frontend)
    type: { type: String, trim: true, default: "Fragrance" },

    // real category relationship, used for filtering
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },

    price: { type: Number, required: true, min: 0 },
    badge: { type: String, default: null },
    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    sizes: { type: [String], default: ["30ml", "50ml", "100ml"] },
    images: { type: [imageSchema], default: [] },
    desc: { type: String, default: "" },
    notes: { type: notesSchema, default: () => ({}) },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", type: "text", desc: "text" });

export default mongoose.model("Product", productSchema);
