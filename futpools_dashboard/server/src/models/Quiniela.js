import mongoose from "mongoose";

const fixtureSchema = new mongoose.Schema({
  fixtureId: { type: Number, required: true },
  leagueId: { type: Number },
  leagueName: { type: String, default: "" },
  homeTeamId: { type: Number },
  awayTeamId: { type: Number },
  homeTeam: { type: String, required: true },
  awayTeam: { type: String, required: true },
  homeLogo: { type: String, default: "" },
  awayLogo: { type: String, default: "" },
  kickoff: { type: Date, required: true },
  status: { type: String, default: "" }
}, { _id: false });

const quinielaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  prize: { type: String, required: true },
  cost: { type: String, required: true },
  currency: { type: String, default: "MXN" },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  fixtures: { type: [fixtureSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Quiniela", quinielaSchema);
