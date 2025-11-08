import React, { useEffect, useState } from "react";

export default function LatestMembitPosts() {
  const [posts, setPosts] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    function fetchWithTimeout(url: string, options: any = {}, ms = 10000) {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { ...options, signal: ctrl.signal })
        .catch((e) => {
          if (e && e.name === 'AbortError') throw new Error('Request timed out');
          throw e;
        })
        .finally(() => clearTimeout(id));
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetchWithTimeout("/api/membit/trends", {
          method: "GET",
          headers: { accept: "application/json" },
        }, 10000);

        const text = await resp.text();
        if (!resp.ok) {
          setError(`Membit API error ${resp.status}: ${text}`);
          return;
        }

        let json: any;
        try {
          json = JSON.parse(text);
        } catch (e) {
          setError("Invalid JSON from Membit API");
          return;
        }

        // Try to locate posts in the response
        // possible locations: json.posts, json.mcp.posts, json.data.posts, json.items, json.topics
        let extracted: any[] | null = null;
        if (Array.isArray(json.posts)) extracted = json.posts;
        else if (json.mcp && Array.isArray(json.mcp.posts)) extracted = json.mcp.posts;
        else if (json.mcp && Array.isArray(json.mcp.items)) extracted = json.mcp.items;
        else if (Array.isArray(json.items)) extracted = json.items;
        else if (Array.isArray(json.data?.posts)) extracted = json.data.posts;
        else if (Array.isArray(json.data)) extracted = json.data;
        else if (Array.isArray(json.topics)) extracted = json.topics; // fallback: topics as posts-like

        if (!extracted) {
          setPosts([]);
          setError("No posts available from Membit API response.");
          return;
        }

        // Normalize post fields: title, sentiment, timestamp
        const normalized = extracted.map((p: any, i: number) => ({
          id: p.id ?? p.post_id ?? p.chatId ?? `post-${i}`,
          title: p.title ?? p.text ?? p.content ?? p.body ?? p.name ?? String(p).slice(0, 80),
          sentiment:
            typeof p.sentiment === "number"
              ? p.sentiment
              : typeof p.sent === "number"
              ? p.sent
              : p.sentimentScore ?? null,
          ts: p.ts ?? p.timestamp ?? p.created_at ?? p.time ?? null,
        }));

        if (mounted) {
          setPosts(normalized);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setError(String(err?.message ?? err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-[#0f0f0f]/80 neon-border p-4">
      <div className="px-1 py-2 text-sm tracking-wide text-foreground/70">Latest Membit Posts</div>

      <div className="mt-3 space-y-3">
        {loading && <div className="text-xs text-foreground/60">Loading posts…</div>}
        {error && <div className="text-xs text-secondary">{error}</div>}

        {!loading && !error && posts.length === 0 && (
          <div className="text-xs text-foreground/60">No recent posts available from Membit.</div>
        )}

        {posts.map((p) => (
          <div key={p.id} className="p-3 rounded-md bg-[#061216] border border-cyan-400/10">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-foreground">{p.title}</div>
              <div className="text-xs text-foreground/60">{p.ts ? new Date(p.ts).toLocaleString() : "—"}</div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-foreground/70">Sentiment: {p.sentiment !== null && p.sentiment !== undefined ? Math.round(((p.sentiment + 1) / 2) * 100) + '%' : 'N/A'}</div>
              <div className="text-xs text-foreground/60">ID: {String(p.id).slice(0, 8)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
