import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { membitTrends } from "./routes/membit";
import { searchPosts, searchClusters } from "./routes/membitProxy";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Membit proxy endpoints (mock fallback if no API key)
  app.get("/api/membit/trends", membitTrends);
  app.post("/api/membit/search-posts", searchPosts);
  app.post("/api/membit/search-clusters", searchClusters);

  // Agent endpoint (runs Membit queries + LLM prediction)
  app.post("/api/agent/run", (await import("./routes/agent")).runAgent);

  return app;
}
