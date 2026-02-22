import "dotenv/config";
import mongoose from "mongoose";
import Admin from "../src/models/Admin.js";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const email = String(process.env.ADMIN_EMAIL || "admin@futpools.app").toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "Password123");

  const existing = await Admin.findOne({ email }).select("_id");
  if (existing) {
    console.log("Admin already exists:", email);
    process.exit(0);
  }

  await Admin.create({ email, password });
  console.log("Admin created:", email);
  process.exit(0);
};

run().catch((err) => {
  console.error("Seed admin error:", err.message);
  process.exit(1);
});
