import type { RequestHandler } from "express";

export const flowiseChat: RequestHandler = async (req, res) => {
  try {
    const url = process.env.FLOWISE_API_URL;
    const key = process.env.FLOWISE_API_KEY;
    if (!url) return res.status(500).json({ error: "FLOWISE_API_URL not configured on server" });

    const body = req.body || {};

    // Normalize payload to Flowise expected shape: { question: "..." }
    const question = typeof body.question === 'string' ? body.question : (typeof body.input === 'string' ? body.input : (typeof body.message === 'string' ? body.message : (typeof body.query === 'string' ? body.query : '')));
    const payload: any = { question };
    if (body.meta) payload.meta = body.meta;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (key) {
      headers["x-api-key"] = key;
      headers["Authorization"] = `Bearer ${key}`;
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Flowise error ${resp.status}: ${text}` });
    }
    try {
      const json = JSON.parse(text);
      return res.json(json);
    } catch (e) {
      return res.send(text);
    }
  } catch (err: any) {
    console.error('/api/flowise/chat error', err?.message ?? err);
    res.status(500).json({ error: err?.message ?? String(err) });
  }
};
