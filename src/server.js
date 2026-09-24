import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

import authRoutes from "./routes/authRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

const app = express();

// ---- Core middleware (order matters) ----
const allowedOrigins = [
  process.env.CLIENT_URL, // set this on Railway to your Vercel production URL
  "https://nk-perfume-blush.vercel.app",
  "http://localhost:3000",
].filter(Boolean); // drops CLIENT_URL from the list if it isn't set

app.use(
  cors({
    origin: (origin, callback) => {
      const isAllowed =
        !origin || // allow tools like curl/Postman/health checks with no Origin header
        allowedOrigins.includes(origin) ||
        /^https:\/\/nk-perfume-.*\.vercel\.app$/.test(origin); // any Vercel preview URL for this project

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ---- Health check ----
app.get("/", (req, res) => {
  res.json({ success: true, message: "NK Fragrances API is running" });
});

// ---- Routes ----
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

// ---- Error handling (must be last) ----
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  });
};

start();