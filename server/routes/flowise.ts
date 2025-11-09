import type { RequestHandler } from "express";

function normalizeBaseUrl(base: string) {
  if (!base) return base;
  return base.replace(/\/$/, "");
}

export const flowiseChat: RequestHandler = async (req, res) => {
  try {
    const base = process.env.FLOWISE_API_URL;
    const key = process.env.FLOWISE_API_KEY;

    console.log("=== Flowise Chat Started ===");
    console.log("FLOWISE_API_URL:", base);
    console.log("FLOWISE_API_KEY configured:", !!key);

    if (!base)
      return res
        .status(500)
        .json({ error: "FLOWISE_API_URL not configured on server" });

    const body = req.body || {};
    const question =
      typeof body.question === "string"
        ? body.question
        : typeof body.input === "string"
          ? body.input
          : typeof body.message === "string"
            ? body.message
            : typeof body.query === "string"
              ? body.query
              : "";

    console.log("Question preview:", question.substring(0, 100));

    const payload: any = { question };
    if (body.meta) payload.meta = body.meta;

    const baseUrl = normalizeBaseUrl(base);
    const endpoint = baseUrl.match(/\/prediction|\/chat/)
      ? baseUrl
      : `${baseUrl}/prediction`;

    console.log("Endpoint:", endpoint);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (key) {
      headers["Authorization"] = `Bearer ${key}`;
      headers["x-api-key"] = key;
      console.log("Auth headers configured");
    }

    // --- Fetch ke Flowise
    console.log("📨 Sending request to Flowise...");
    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    console.log("Response status:", resp.status);

    const text = await resp.text();
    console.log("Response preview:", text.substring(0, 300));

    if (!resp.ok) {
      console.error(`❌ Flowise error ${resp.status}: ${text}`);
      return res
        .status(resp.status)
        .json({ error: `Flowise error ${resp.status}: ${text}` });
    }

    // --- Parsing aman
    let json: any = {};
    try {
      json = JSON.parse(text);
      console.log("✅ Successfully parsed JSON response");
    } catch {
      console.warn("⚠️ Could not parse as JSON, treating as text");
      json = { text };
    }

    // --- Normalisasi output agar UI bisa langsung menampilkan
    const reply = {
      ok: true,
      text: json.text || json.answer || text || "No response",
      raw: json,
      chatId: json.chatId,
      followUps: json.followUpPrompts
        ? JSON.parse(json.followUpPrompts)
        : [],
    };

    console.log("✅ Flowise chat successful");
    return res.json(reply);
  } catch (err: any) {
    console.error("/api/flowise/chat error", err?.message ?? err);
    res.status(500).json({ error: err?.message ?? String(err) });
  }
};

export const flowiseConfig: RequestHandler = async (_req, res) => {
  const url = !!process.env.FLOWISE_API_URL;
  const key = !!process.env.FLOWISE_API_KEY;
  const chatflowId = !!process.env.FLOWISE_CHATFLOW_ID;

  console.log("=== Flowise Config Check ===");
  console.log("URL configured:", url);
  console.log("Key configured:", key);
  console.log("ChatflowID configured:", chatflowId);

  res.json({
    ok: true,
    urlConfigured: url,
    keyConfigured: key,
    chatflowIdConfigured: chatflowId,
  });
};
