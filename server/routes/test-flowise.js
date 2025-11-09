// test-flowise.js
import fetch from "node-fetch";

const base =
  process.env.FLOWISE_API_URL ||
  "https://your-flowise-url/prediction";
const key = process.env.FLOWISE_API_KEY || "your-flowise-key";
const chatflowId = process.env.FLOWISE_CHATFLOW_ID || "your-chatflow-id";

console.log("=== Testing Flowise Connection ===");
console.log("URL:", base);
console.log("Key available:", !!key);
console.log("Chatflow ID:", chatflowId);
console.log("");

async function testConnection() {
  try {
    const endpoint = base.replace(/\/$/, "");

    const headers = {
      "Content-Type": "application/json",
    };

    if (key) {
      headers["Authorization"] = `Bearer ${key}`;
      headers["x-api-key"] = key;
    }

    const payload = {
      question: "Hello, test message",
    };

    console.log("🔍 Endpoint:", endpoint);
    console.log("🔍 Auth configured:", !!key);
    console.log("📨 Sending request...\n");

    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    console.log("📋 Response Status:", resp.status);
    console.log("📋 Response Headers:", {
      contentType: resp.headers.get("content-type"),
    });

    const text = await resp.text();
    console.log("📋 Response Body:", text.substring(0, 500));
    console.log("");

    if (resp.ok) {
      console.log("✅ Flowise connection SUCCESSFUL");
      try {
        const json = JSON.parse(text);
        console.log("✅ Response is valid JSON");
        console.log("📊 Parsed data:", JSON.stringify(json, null, 2));
      } catch (e) {
        console.log("⚠️ Response is not JSON, but connection succeeded");
      }
    } else {
      console.log("❌ Flowise connection FAILED");
      console.log("❌ Status:", resp.status);
      console.log("❌ Error:", text);
    }
  } catch (error) {
    console.log("❌ Flowise connection ERROR:", (error as any).message);
    console.log("❌ Full error:", error);
  }
}

testConnection();
