import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import footballRoutes from "./routes/football.js";
import quinielaRoutes from "./routes/quinielas.js";
import settingsRoutes from "./routes/settings.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/football", footballRoutes);
app.use("/api/quinielas", quinielaRoutes);
app.use("/api/settings", settingsRoutes);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Dashboard server running on port ${PORT}`);
  });
});
