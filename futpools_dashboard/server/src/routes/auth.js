import express from "express";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const admin = await Admin.findOne({ email: String(email).toLowerCase() }).select("+password");
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, admin: { email: admin.email } });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
