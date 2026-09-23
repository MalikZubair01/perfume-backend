import jwt from "jsonwebtoken";

const generateToken = (id, role = "admin") => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

export default generateToken;
