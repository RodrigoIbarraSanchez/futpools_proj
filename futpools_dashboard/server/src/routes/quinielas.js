import express from "express";
import Quiniela from "../models/Quiniela.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.post("/", auth, async (req, res) => {
  try {
    const { name, description, prize, cost, currency, fixtures } = req.body || {};
    if (!name || !prize || !cost || !Array.isArray(fixtures) || fixtures.length === 0) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const kickoffDates = fixtures
      .map((f) => new Date(f.kickoff))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b);
    if (!kickoffDates.length) {
      return res.status(400).json({ message: "Invalid fixtures dates" });
    }
    const startDate = kickoffDates[0];
    const endDate = kickoffDates[kickoffDates.length - 1];

    const doc = await Quiniela.create({
      name,
      description: description || "",
      prize,
      cost,
      currency: currency || "MXN",
      startDate,
      endDate,
      fixtures,
      createdBy: req.adminId,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.get("/", auth, async (_req, res) => {
  try {
    const list = await Quiniela.find().sort({ createdAt: -1 }).limit(50);
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const doc = await Quiniela.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Quiniela not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const { name, description, prize, cost, currency, fixtures } = req.body || {};
    const doc = await Quiniela.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Quiniela not found" });
    if (name !== undefined) doc.name = String(name).trim();
    if (description !== undefined) doc.description = String(description || "").trim();
    if (prize !== undefined) doc.prize = String(prize).trim();
    if (cost !== undefined) doc.cost = String(cost).trim();
    if (currency !== undefined) doc.currency = String(currency || "MXN").trim();
    if (Array.isArray(fixtures) && fixtures.length > 0) {
      const kickoffDates = fixtures
        .map((f) => new Date(f.kickoff))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a - b);
      if (kickoffDates.length) {
        doc.startDate = kickoffDates[0];
        doc.endDate = kickoffDates[kickoffDates.length - 1];
      }
      doc.fixtures = fixtures;
    }
    doc.updatedAt = new Date();
    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const doc = await Quiniela.findByIdAndDelete(req.params.id);
    // Idempotent: 204 whether deleted now or already missing (e.g. removed by main app backend)
    if (!doc) return res.status(204).send();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
