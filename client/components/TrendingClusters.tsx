import React, { useEffect, useState } from "react";

export default function TrendingClusters() {
  const [clusters, setClusters] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
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
        const resp = await fetchWithTimeout("/api/membit/clusters", { headers: { accept: 'application/json' } }, 10000);
        const text = await resp.text();
        if (!resp.ok) {
          setError(`Membit API error ${resp.status}: ${text}`);
          setClusters([]);
          return;
        }
        let json: any;
        try { json = JSON.parse(text); } catch (e) { setError('Invalid JSON from clusters endpoint'); setClusters([]); return; }
        if (!mounted) return;
        setClusters(Array.isArray(json.clusters) ? json.clusters : []);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        if (msg === 'Request timed out') return;
        setError(String(err?.message ?? err));
        setClusters([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-[#0f0f0f]/80 neon-border p-4">
      <div className="px-1 py-2 text-sm tracking-wide text-foreground/70">Trending Clusters & Posts</div>
      <div className="mt-3 space-y-3">
        {loading && <div className="text-xs text-foreground/60">Loading clusters…</div>}
        {error && <div className="text-xs text-secondary">{error}</div>}
        {!loading && !error && (!clusters || clusters.length === 0) && (
          <div className="text-xs text-foreground/60">No trending posts found.</div>
        )}

        {clusters && clusters.map((c, idx) => (
          <div key={idx} className="p-3 rounded-md bg-[#061216] border border-cyan-400/10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">{c.label ?? c.name ?? 'Untitled Cluster'}</div>
                <div className="text-xs text-foreground/60 mt-1">{c.summary ?? c.description ?? ''}</div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {Array.isArray(c.posts) && c.posts.length > 0 ? c.posts.slice(0,3).map((p:any, i:number) => (
                    <div key={i} className="p-2 rounded-md bg-[#071722] border border-cyan-400/10">
                      <div className="text-xs font-semibold text-foreground">{p.title ?? p.content ?? p.text ?? (p.uuid ?? p.id)}</div>
                      <div className="text-[11px] text-foreground/60 mt-1">{p.timestamp ? new Date(p.timestamp).toLocaleString() : (p.ts ? new Date(p.ts).toLocaleString() : '—')}</div>
                      <div className="text-[11px] text-foreground/70 mt-2">Sentiment: {p.sentiment !== undefined && p.sentiment !== null ? Math.round(((p.sentiment+1)/2)*100) + '%' : (p.engagement_score ? Math.round(p.engagement_score) : 'N/A')}</div>
                    </div>
                  )) : (
                    <div className="text-xs text-foreground/60">No posts in this cluster.</div>
                  )}
                </div>
              </div>
              <div className="w-36 text-right">
                <div className="text-xs text-foreground/60">Category</div>
                <div className="text-sm font-semibold">{c.category ?? '—'}</div>
                <div className="text-xs text-foreground/70 mt-2">Engagement: {c.engagement_score ? Math.round(c.engagement_score) : '—'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
