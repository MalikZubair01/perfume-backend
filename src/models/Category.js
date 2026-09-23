import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true }, // e.g. "Eau de Parfum", "Attar", "Gift Sets"
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    image: {
      url: { type: String, default: null },
      public_id: { type: String, default: null },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
