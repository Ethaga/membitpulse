import serverless from "serverless-http";
import { createServer } from "../../dist/server/index.js";

console.log("=== Netlify Function Initializing ===");
console.log("Flowise API URL:", process.env.FLOWISE_API_URL ? "✅ Configured" : "❌ Not configured");
console.log("Flowise API Key:", process.env.FLOWISE_API_KEY ? "✅ Configured" : "❌ Not configured");
console.log("Membit API Key:", process.env.MEMBIT_API_KEY ? "✅ Configured" : "❌ Not configured");

export const handler = serverless(createServer());
