import express from "express";
import { auth } from "../middleware/auth.js";

const router = express.Router();
const MAIN_BACKEND_URL = (process.env.MAIN_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
const SETTINGS_API_KEY = process.env.SETTINGS_API_KEY;

router.get("/", auth, async (_req, res) => {
  try {
    const r = await fetch(`${MAIN_BACKEND_URL}/settings`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json(data);
    }
    res.json(data);
  } catch (err) {
    res.status(502).json({ message: err.message || "Failed to fetch settings" });
  }
});

router.put("/", auth, async (req, res) => {
  if (!SETTINGS_API_KEY) {
    return res.status(503).json({ message: "SETTINGS_API_KEY not configured" });
  }
  try {
    const r = await fetch(`${MAIN_BACKEND_URL}/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": SETTINGS_API_KEY,
      },
      body: JSON.stringify(req.body || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json(data);
    }
    res.json(data);
  } catch (err) {
    res.status(502).json({ message: err.message || "Failed to update settings" });
  }
});

export default router;
