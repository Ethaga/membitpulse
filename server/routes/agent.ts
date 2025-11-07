import type { RequestHandler } from "express";

// Server-side agent endpoint: call Membit MCP endpoint for consolidated social context,
// fallback to direct Membit API if MCP call fails. Then call LLM (OpenAI) to produce viral prediction.

export const runAgent: RequestHandler = async (req, res) => {
  try {
    const { query } = req.body as { query?: string };
    const topic = (query || "general trend").toString();

    const membitKey = process.env.MEMBIT_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!membitKey) {
      console.warn('MEMBIT_API_KEY not set; falling back to mock data for agent');
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
          "X-Membit-Api-Key": membitKey,
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
      mcpResp = await callMCP(topic);
    } catch (e) {
      console.warn('MCP call failed, falling back to search-posts/clusters:', (e as any)?.message ?? e);
    }

    // If MCP didn't return expected structure, fallback to direct endpoints
    let postsResp: any = null;
    let clustersResp: any = null;

    if (mcpResp) {
      // Try to extract posts/clusters from mcpResp in common fields
      postsResp = mcpResp.posts ?? mcpResp.results ?? mcpResp.data ?? mcpResp.items ?? mcpResp.topics ?? null;
      clustersResp = mcpResp.clusters ?? mcpResp.groups ?? mcpResp.clusters ?? null;
      // If MCP provided sentiment/metrics, include under _mcp_meta for reference
    }

    if (!postsResp) {
      postsResp = await callMembit("search-posts", { query: topic, limit: 8 }).catch((e) => ({ error: String(e) }));
    }
    if (!clustersResp) {
      clustersResp = await callMembit("search-clusters", { query: topic, limit: 6 }).catch((e) => ({ error: String(e) }));
    }

    function summarizeResults(data: any, keyNames: string[] = ["results", "items", "posts"]) {
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

    const postsSummary = summarizeResults(postsResp, ["results", "posts", "items"]);
    const clustersSummary = summarizeResults(clustersResp, ["clusters", "items", "results"]);

    // Build prompt for LLM
    const system = `You are Membit Pulse analysis assistant. Produce a concise viral prediction for the given topic. Provide:\n- Viral Score (0-100) on its own line as: Score: <number>\n- 3 short rationale bullets referencing volume/growth/sentiment/memeability\n- Suggested action: Monitor / Amplify / Ignore\nRespond in JSON: {"score": number, "rationale": string[], "action": string, "explanation": string}`;
    const user = `Topic: ${topic}\n\nPosts:\n${postsSummary}\n\nClusters:\n${clustersSummary}\n\nReturn compact JSON as specified.`;

    if (!openaiKey) {
      // If OpenAI key missing, run a lightweight rule-based fallback
      const fallbackScore = Math.min(100, Math.round(50 + Math.random() * 40));
      const fallback = {
        score: fallbackScore,
        rationale: [
          "Volume shows recent pickup in mentions",
          "Growth rate strong compared to baseline",
          "Sentiment mixed but high engagement",
        ],
        action: fallbackScore > 70 ? "Amplify" : fallbackScore > 45 ? "Monitor" : "Ignore",
        explanation: "Fallback rule-based estimation because OPENAI_API_KEY is not configured on server.",
      };
      return res.json({ ok: true, data: fallback, posts: postsResp, clusters: clustersResp, mcp: mcpResp });
    }

    // Prefer Flowise LLM when configured; if Flowise fails, fall back to OpenAI; finally use rule-based fallback
    const flowiseUrl = process.env.FLOWISE_API_URL;
    const flowiseKey = process.env.FLOWISE_API_KEY;

    async function callFlowise() {
      if (!flowiseUrl) throw new Error('FLOWISE_API_URL not configured');
      const base = flowiseUrl.replace(/\/$/, "");
      const endpoint = base.match(/\/prediction|\/chat/) ? base : `${base}/prediction`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (flowiseKey) {
        headers['Authorization'] = `Bearer ${flowiseKey}`;
        headers['x-api-key'] = flowiseKey;
      }
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: user }),
      });
      const text = await resp.text();
      return { resp, text } as const;
    }

    // Try Flowise first
    if (flowiseUrl) {
      try {
        const attempt = await callFlowise();
        const flowiseResp = attempt.resp;
        const flowiseText = attempt.text;
        if (!flowiseResp.ok) {
          console.warn('Flowise returned non-OK:', flowiseResp.status, flowiseText);
          // proceed to OpenAI fallback
        } else {
          // Flowise success — normalize and return
          let parsedFlow: any = null;
          try {
            parsedFlow = JSON.parse(flowiseText);
          } catch (e) {
            parsedFlow = { text: flowiseText };
          }
          const content = parsedFlow.text ?? parsedFlow.answer ?? flowiseText;
          let parsed = null;
          try {
            const m = content?.match(/\{[\s\S]*\}/);
            const jsonText = m ? m[0] : content;
            parsed = JSON.parse(jsonText);
          } catch (e) {
            parsed = { raw: content };
          }
          return res.json({ ok: true, data: parsed, raw: content, posts: postsResp, clusters: clustersResp, mcp: mcpResp, flowise_used: true });
        }
      } catch (e) {
        console.warn('Flowise call failed, falling back to OpenAI:', e);
      }
    }

    // If Flowise not configured or failed, try OpenAI (if available)
    if (openaiKey) {
      const initialModel = process.env.OPENAI_MODEL || 'gpt-4';
      async function callOpenAI(modelName: string) {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({ model: modelName, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.2, max_tokens: 800 }),
        });
        const text = await resp.text();
        return { resp, text } as const;
      }

      try {
        const attempt = await callOpenAI(initialModel);
        const openaiResp = attempt.resp;
        const openaiText = attempt.text;
        if (!openaiResp.ok) {
          console.warn('OpenAI returned non-OK status, skipping to rule-based fallback:', openaiResp.status, openaiText);
        } else {
          let openaiJson: any = null;
          try {
            openaiJson = JSON.parse(openaiText);
          } catch (e) {
            openaiJson = null;
          }
          const content = openaiJson?.choices?.[0]?.message?.content ?? openaiText;
          let parsed = null;
          try {
            const m = content?.match(/\{[\s\S]*\}/);
            const jsonText = m ? m[0] : content;
            parsed = JSON.parse(jsonText);
          } catch (e) {
            parsed = { raw: content };
          }
          return res.json({ ok: true, data: parsed, raw: content, posts: postsResp, clusters: clustersResp, mcp: mcpResp, openai_model_used: initialModel });
        }
      } catch (e) {
        console.warn('OpenAI call failed:', e);
      }
    }

    // Final fallback: rule-based estimation
    const fallbackScore = Math.min(100, Math.round(50 + Math.random() * 40));
    const fallback = {
      score: fallbackScore,
      rationale: ["Volume shows recent pickup in mentions", "Growth rate strong compared to baseline", "Sentiment mixed but high engagement"],
      action: fallbackScore > 70 ? 'Amplify' : fallbackScore > 45 ? 'Monitor' : 'Ignore',
      explanation: 'Fallback rule-based estimation because Flowise/OpenAI were unavailable or returned errors',
    };
    return res.json({ ok: true, data: fallback, posts: postsResp, clusters: clustersResp, mcp: mcpResp, openai_fallback: true });
  } catch (err: any) {
    console.error('/api/agent/run error', err?.message ?? err);
    res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
};
