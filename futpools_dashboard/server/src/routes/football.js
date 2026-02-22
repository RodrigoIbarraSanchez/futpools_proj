import express from "express";
import { searchTeams, searchLeagues, getTeamFixtures, getLeagueFixtures } from "../services/apiFootball.js";
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

router.get("/leagues/search", auth, async (req, res) => {
  try {
    const q = String(req.query.query || "").trim();
    if (!q) return res.status(400).json({ message: "query is required" });
    const leagues = await searchLeagues(q);
    res.json(leagues);
  } catch (err) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.get("/fixtures", auth, async (req, res) => {
  try {
    const teamId = Number(req.query.teamId || 0);
    const leagueId = Number(req.query.leagueId || 0);
    const season = Number(req.query.season || 0);

    if (leagueId) {
      const fixtures = await getLeagueFixtures(leagueId, season || undefined);
      return res.json(fixtures);
    }

    if (teamId) {
      const fixtures = await getTeamFixtures(teamId);
      return res.json(fixtures);
    }

    return res.status(400).json({ message: "teamId or leagueId is required" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
