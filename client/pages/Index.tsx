import { useMemo, useState } from "react";
import Filters, { type Category } from "@/components/Filters";
import TrendStream from "@/components/TrendStream";
import SentimentChart from "@/components/SentimentChart";
import CPIGauge from "@/components/CPIGauge";
import ViralPanel from "@/components/ViralPanel";
import AgentResultCard from "@/components/AgentResultCard";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import AnalysisHistory from "@/components/AnalysisHistory";
import { useRealTimeTrends } from "@/hooks/useRealTimeTrends";
import type { TrendTopic } from "@shared/api";

function classifyCategory(name: string): Category {
  const n = name.toLowerCase();
  if (/(ai|agent|neural|gpu|llm|model)/.test(n)) return "AI";
  if (/(crypto|defi|eth|btc|chain|layer)/.test(n)) return "Crypto";
  if (/(election|policy|govern|geopolit|state)/.test(n)) return "Politics";
  if (/(tech|infra|compute|startup)/.test(n)) return "Tech";
  if (/(bio|biohack|genome|crispr)/.test(n)) return "Bio";
  return "Other";
}

export default function Index() {
  const { data, sortedTopics, loading, error } = useRealTimeTrends({ intervalMs: 60000, immediate: true });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{ posts?: any; clusters?: any } | null>(null);

  const [history, setHistory] = useState<any[]>([]);

  // load history from localStorage once
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('membit_analysis_history');
      if (raw) setHistory(JSON.parse(raw));
    } catch (e) {
      console.warn('Failed to load history', e);
    }
  }, []);

  const pushHistory = (item: any) => {
    const next = [item, ...history].slice(0, 20);
    setHistory(next);
    try {
      localStorage.setItem('membit_analysis_history', JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save history', e);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem('membit_analysis_history'); } catch {}
  };

  const filtered: TrendTopic[] = useMemo(() => {
    let base = sortedTopics;
    if (category !== "All") base = base.filter((t) => classifyCategory(t.name) === category);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      base = base.filter((t) =>
        t.name.toLowerCase().includes(q) || t.keywords.some((k) => k.toLowerCase().includes(q)),
      );
    }
    return base;
  }, [sortedTopics, query, category]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="text-xs uppercase tracking-[0.3em] text-foreground/60">Project: Membit Pulse — Cypherpunk Edition</div>
        <h1 className="text-2xl md:text-3xl font-extrabold glow-cyan">AI Dashboard for Real-Time Trends</h1>
      </div>

      <Filters query={query} category={category} onQueryChange={setQuery} onCategoryChange={setCategory} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TrendStream topics={filtered} />
        </div>
        <div className="lg:col-span-1 space-y-6">
          {data && <CPIGauge value={data.cpi.cpi} />}
          {data && <SentimentChart data={data.sentiment} />}
        </div>
      </div>

      <ViralPanel topics={filtered} />

      <div className="rounded-2xl border border-cyan-400/30 bg-[#0f0f0f]/80 neon-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm tracking-wide text-foreground/70">Run Viral Analysis</div>
            <div className="text-xs text-foreground/60">Analyze a topic using Membit data + LLM prediction</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  setAnalysisLoading(true);
                  setAnalysisError(null);
                  const target = query.trim() || filtered[0]?.name || "";
                  const resp = await fetch('/api/agent/run', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ query: target }),
                  });
                  const json = await resp.json();
                  if (!json.ok) {
                    setAnalysisError(json.error || 'Agent failed');
                  } else {
                    setAnalysisResult(json.data || json.raw || json);
                    setAnalysisMeta({ posts: json.posts, clusters: json.clusters });
                  }
                } catch (err: any) {
                  setAnalysisError(err?.message ?? String(err));
                } finally {
                  setAnalysisLoading(false);
                }
              }}
              className="px-4 py-2 rounded-xl border border-cyan-400/40 glow-cyan hover:bg-primary/10"
            >
              Run Analysis
            </button>
          </div>
        </div>

        <div className="mt-4">
          {analysisLoading && <div className="text-sm text-foreground/60">Running analysis…</div>}
          {analysisError && <div className="text-sm text-secondary">{analysisError}</div>}
          {analysisResult && (
            <AgentResultCard result={analysisResult} meta={analysisMeta} />
          )}
        </div>
      </div>

      {loading && (
        <div className="text-sm text-foreground/60">Loading real-time data…</div>
      )}
      {error && (
        <div className="text-sm text-secondary">Failed to load latest trends. Showing cached/mock data.</div>
      )}
    </div>
  );
}
