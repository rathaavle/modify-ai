import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { verifyRouter } from "./routes/verify";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// CORS — hanya izinkan request dari frontend
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  }),
);

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Verification route
app.use("/api/verify", verifyRouter);

app.listen(PORT, () => {
  console.log(`Medify AI backend running on port ${PORT}`);
});

export default app;
