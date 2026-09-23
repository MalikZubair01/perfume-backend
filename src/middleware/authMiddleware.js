import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

// Verifies the JWT sent as "Authorization: Bearer <token>" header.
// On success attaches the logged-in admin to req.admin.
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, admin no longer exists",
      });
    }

    req.admin = admin; // available in every controller after this middleware
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, invalid or expired token",
    });
  }
};

// Optional extra layer if you later add roles (admin vs superadmin)
export const isAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ success: false, message: "Not authorized" });
  }
  if (!["admin", "superadmin"].includes(req.admin.role)) {
    return res.status(403).json({ success: false, message: "Admins only" });
  }
  next();
};
