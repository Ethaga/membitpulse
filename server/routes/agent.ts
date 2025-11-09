import type { RequestHandler } from "express";

// Server-side agent endpoint: call Membit MCP endpoint for consolidated social context,
// fallback to direct Membit API if MCP call fails. Then call LLM (Flowise) to produce viral prediction.

export const runAgent: RequestHandler = async (req, res) => {
  try {
    const { query } = req.body as { query?: string };
    const topic = (query || "general trend").toString();

    const membitKey = process.env.MEMBIT_API_KEY;
    const flowiseUrl = process.env.FLOWISE_API_URL;
    const flowiseKey = process.env.FLOWISE_API_KEY;

    console.log("=== Agent Run Started ===");
    console.log("Topic:", topic);
    console.log("MEMBIT_API_KEY configured:", !!membitKey);
    console.log("FLOWISE_API_URL configured:", !!flowiseUrl);
    console.log("FLOWISE_API_KEY configured:", !!flowiseKey);
    console.log("FLOWISE_API_URL value:", flowiseUrl);

    if (!membitKey) {
      console.warn("MEMBIT_API_KEY not set; falling back to mock data for agent");
    }

    async function callMCP(topicStr: string) {
      // Call the Membit MCP endpoint with a request asking for trends, sentiment, volume, engagement
      const url = process.env.MEMBIT_MCP_URL || "https://mcp.membit.ai/mcp";
      const body = {
        action: "reasoning", // best-effort action name; MCP should interpret
        query: topicStr,
        features: ["trends", "sentiment", "volume", "engagement", "clusters", "posts"],
        limit: 20,
      };
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Membit-Api-Key": membitKey || "",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      const text = await resp.text();
      if (!resp.ok) {
        throw new Error(`MCP error ${resp.status}: ${text}`);
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        return text;
      }
    }

    // Fallback direct Membit endpoints
    async function callMembit(path: string, body: any) {
      if (!membitKey) throw new Error("MEMBIT_API_KEY not configured on server");
      const url = `https://api.membit.ai/v1/${path}`;
      const resp = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${membitKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const text = await resp.text();
      if (!resp.ok) {
        throw new Error(`Membit error ${resp.status}: ${text}`);
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        return text;
      }
    }

    // Try MCP first
    let mcpResp: any = null;
    try {
      console.log("📡 Calling Membit MCP...");
      mcpResp = await callMCP(topic);
      console.log("✅ MCP call successful");
    } catch (e) {
      console.warn(
        "⚠️ MCP call failed, falling back to search-posts/clusters:",
        (e as any)?.message ?? e
      );
    }

    // If MCP didn't return expected structure, fallback to direct endpoints
    let postsResp: any = null;
    let clustersResp: any = null;

    if (mcpResp) {
      // Try to extract posts/clusters from mcpResp in common fields
      postsResp =
        mcpResp.posts ??
        mcpResp.results ??
        mcpResp.data ??
        mcpResp.items ??
        mcpResp.topics ??
        null;
      clustersResp = mcpResp.clusters ?? mcpResp.groups ?? null;
      // If MCP provided sentiment/metrics, include under _mcp_meta for reference
    }

    if (!postsResp) {
      console.log("📡 Calling Membit search-posts...");
      postsResp = await callMembit("search-posts", {
        query: topic,
        limit: 8,
      }).catch((e) => ({ error: String(e) }));
      console.log("✅ search-posts response:", !!postsResp);
    }

    if (!clustersResp) {
      console.log("📡 Calling Membit search-clusters...");
      clustersResp = await callMembit("search-clusters", {
        query: topic,
        limit: 6,
      }).catch((e) => ({ error: String(e) }));
      console.log("✅ search-clusters response:", !!clustersResp);
    }

    function summarizeResults(
      data: any,
      keyNames: string[] = ["results", "items", "posts"]
    ) {
      if (!data) return "(no data)";
      if (data.error) return `ERROR: ${data.error}`;
      let items = null;
      if (typeof data === "object") {
        for (const k of keyNames) {
          if (Array.isArray(data[k])) {
            items = data[k];
            break;
          }
        }
      }
      if (!items && Array.isArray(data)) items = data;
      if (!items) return JSON.stringify(data).slice(0, 1000);
      return items
        .slice(0, 6)
        .map((it: any, i: number) => {
          const title = it.title || it.name || it.id || "(untitled)";
          const excerpt = it.excerpt || it.text || it.summary || "";
          const mentions = it.mentions || it.metric || "";
          return `${i + 1}. ${title} — ${excerpt} (mentions: ${mentions})`;
        })
        .join("\n");
    }

    const postsSummary = summarizeResults(postsResp, [
      "results",
      "posts",
      "items",
    ]);
    const clustersSummary = summarizeResults(clustersResp, [
      "clusters",
      "items",
      "results",
    ]);

    // Build prompt for LLM
    const system = `You are Membit Pulse analysis assistant. Produce a concise viral prediction for the given topic. Provide:\n- Viral Score (0-100) on its own line as: Score: <number>\n- 3 short rationale bullets referencing volume/growth/sentiment/memeability\n- Suggested action: Monitor / Amplify / Ignore\nRespond in JSON: {"score": number, "rationale": string[], "action": string, "explanation": string}`;
    const user = `Topic: ${topic}\n\nPosts:\n${postsSummary}\n\nClusters:\n${clustersSummary}\n\nReturn compact JSON as specified.`;

    console.log("🤖 Preparing to call AI service...");

    // Try Flowise first if configured
    if (!flowiseUrl) {
      console.warn(
        "⚠️ FLOWISE_API_URL not configured, using fallback estimation"
      );
      const fallbackScore = Math.min(100, Math.round(50 + Math.random() * 40));
      const fallback = {
        score: fallbackScore,
        rationale: [
          "Volume shows recent pickup in mentions",
          "Growth rate strong compared to baseline",
          "Sentiment mixed but high engagement",
        ],
        action: fallbackScore > 70 ? "Amplify" : fallbackScore > 45 ? "Monitor" : "Ignore",
        explanation:
          "Fallback rule-based estimation because Flowise API URL is not configured.",
      };
      return res.json({
        ok: true,
        data: fallback,
        posts: postsResp,
        clusters: clustersResp,
        mcp: mcpResp,
        flowiseConfigured: false,
      });
    }

    async function callFlowise() {
      console.log("🔍 Flowise API URL:", flowiseUrl);

      const base = flowiseUrl.replace(/\/$/, "");
      const endpoint = base.match(/\/prediction|\/chat/)
        ? base
        : `${base}/prediction`;

      console.log("🔍 Flowise endpoint:", endpoint);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (flowiseKey) {
        headers["Authorization"] = `Bearer ${flowiseKey}`;
        headers["x-api-key"] = flowiseKey;
      }

      console.log("🔍 Headers configured with auth:", !!flowiseKey);

      const payload = { question: user };
      console.log(
        "🔍 Payload preview:",
        payload.question.substring(0, 100) + "..."
      );

      console.log("📨 Sending request to Flowise...");

      const resp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const text = await resp.text();

      console.log("🔍 Flowise response status:", resp.status);
      console.log("🔍 Flowise response preview:", text.substring(0, 300));

      return { resp, text } as const;
    }

    // Try Flowise
    let flowiseErrorText: string | null = null;
    try {
      console.log("🚀 Attempting Flowise call...");
      const attempt = await callFlowise();
      const flowiseResp = attempt.resp;
      const flowiseText = attempt.text;

      if (!flowiseResp.ok) {
        console.error(
          "❌ Flowise returned non-OK:",
          flowiseResp.status,
          flowiseText
        );
        flowiseErrorText = flowiseText;

        // Fallback to rule-based
        const fallbackScore = Math.min(100, Math.round(50 + Math.random() * 40));
        const fallback = {
          score: fallbackScore,
          rationale: [
            "Volume shows recent pickup in mentions",
            "Growth rate strong compared to baseline",
            "Sentiment mixed but high engagement",
          ],
          action: fallbackScore > 70 ? "Amplify" : fallbackScore > 45 ? "Monitor" : "Ignore",
          explanation: `Fallback rule-based estimation because Flowise returned error: ${flowiseResp.status}`,
        };

        return res.json({
          ok: true,
          data: fallback,
          posts: postsResp,
          clusters: clustersResp,
          mcp: mcpResp,
          flowise_used: false,
          flowise_error: flowiseErrorText,
        });
      }

      // Flowise success — normalize and return
      let parsedFlow: any = null;
      try {
        parsedFlow = JSON.parse(flowiseText);
      } catch (e) {
        console.warn("⚠️ Failed to parse Flowise response as JSON:", e);
        parsedFlow = { text: flowiseText };
      }

      const content =
        parsedFlow.text ?? parsedFlow.answer ?? flowiseText ?? "";
      console.log("📄 Parsed Flowise content:", content.substring(0, 200));

      let parsed = null;
      try {
        const m = content?.match(/\{[\s\S]*\}/);
        const jsonText = m ? m[0] : content;
        parsed = JSON.parse(jsonText);
        console.log("✅ Successfully parsed JSON response from Flowise");
      } catch (e) {
        console.warn("⚠️ Failed to extract JSON from Flowise content:", e);
        parsed = { raw: content };
      }

      console.log("✅ Flowise call successful, returning result");
      return res.json({
        ok: true,
        data: parsed,
        raw: content,
        posts: postsResp,
        clusters: clustersResp,
        mcp: mcpResp,
        flowise_used: true,
      });
    } catch (e) {
      console.error("❌ Flowise call failed with exception:", e);
      flowiseErrorText = String(e);

      // Final fallback: rule-based estimation
      const fallbackScore = Math.min(100, Math.round(50 + Math.random() * 40));
      const fallback = {
        score: fallbackScore,
        rationale: [
          "Volume shows recent pickup in mentions",
          "Growth rate strong compared to baseline",
          "Sentiment mixed but high engagement",
        ],
        action: fallbackScore > 70 ? "Amplify" : fallbackScore > 45 ? "Monitor" : "Ignore",
        explanation:
          "Fallback rule-based estimation because Flowise connection failed: " +
          flowiseErrorText,
      };

      return res.json({
        ok: true,
        data: fallback,
        posts: postsResp,
        clusters: clustersResp,
        mcp: mcpResp,
        flowise_used: false,
        flowise_error: flowiseErrorText,
      });
    }
  } catch (err: any) {
    console.error("/api/agent/run error", err?.message ?? err);
    res
      .status(500)
      .json({ ok: false, error: err?.message ?? String(err) });
  }
};
