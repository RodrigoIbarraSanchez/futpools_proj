import express from "express";
import { searchTeams, getTeamFixtures } from "../services/apiFootball.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/teams/search", auth, async (req, res) => {
  try {
    const q = String(req.query.query || "").trim();
    if (!q) return res.status(400).json({ message: "query is required" });
    const teams = await searchTeams(q);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.get("/fixtures", auth, async (req, res) => {
  try {
    const teamId = Number(req.query.teamId || 0);
    if (!teamId) return res.status(400).json({ message: "teamId is required" });
    const fixtures = await getTeamFixtures(teamId);
    res.json(fixtures);
  } catch (err) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
