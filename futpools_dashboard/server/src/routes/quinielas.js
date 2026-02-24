import express from "express";
import Quiniela from "../models/Quiniela.js";
import { auth } from "../middleware/auth.js";

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

function computePoolStatus(fixtures) {
  if (!fixtures || fixtures.length === 0) return "scheduled";
  const now = new Date();
  let allFinished = true;
  let anyStarted = false;
  for (const f of fixtures) {
    const short = String(f.status || "").trim().toUpperCase();
    if (FINISHED_STATUSES.has(short)) {
      anyStarted = true;
    } else {
      allFinished = false;
      if (short && short !== "NS") anyStarted = true;
      else if (new Date(f.kickoff) <= now) anyStarted = true;
    }
  }
  if (allFinished) return "completed";
  if (anyStarted) return "live";
  return "scheduled";
}

function addPoolStatus(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  return { ...obj, status: computePoolStatus(obj.fixtures || []) };
}

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
    const list = await Quiniela.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json(list.map(addPoolStatus));
  } catch (err) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    const doc = await Quiniela.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Quiniela not found" });
    res.json(addPoolStatus(doc));
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
