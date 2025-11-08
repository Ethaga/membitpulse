import React, { useMemo, useState } from "react";
import Filters, { type Category } from "@/components/Filters";
import TrendStream from "@/components/TrendStream";
import SentimentChart from "@/components/SentimentChart";
import CPIGauge from "@/components/CPIGauge";
import ViralPanel from "@/components/ViralPanel";
import AgentResultCard from "@/components/AgentResultCard";
import FlowiseWidget from "@/components/FlowiseWidget";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import AnalysisHistory from "@/components/AnalysisHistory";
import LatestMembitPosts from "@/components/LatestMembitPosts";
import TrendingClusters from "@/components/TrendingClusters";
import ConfirmModal from "@/components/ConfirmModal";
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

import { useToast } from "@/hooks/use-toast";

export default function Index() {
  const { toast } = useToast();
  const { data, sortedTopics, loading, error } = useRealTimeTrends({
    intervalMs: 60000,
    immediate: true,
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{
    posts?: any;
    clusters?: any;
  } | null>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [lastRunTs, setLastRunTs] = useState<number>(0);

  // load history from localStorage once
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("membit_analysis_history");
      if (raw) setHistory(JSON.parse(raw));
    } catch (e) {
      console.warn("Failed to load history", e);
    }
  }, []);

  const pushHistory = (item: any) => {
    const next = [item, ...history].slice(0, 20);
    setHistory(next);
    try {
      localStorage.setItem("membit_analysis_history", JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to save history", e);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem("membit_analysis_history");
    } catch {}
  };

  async function runAnalysis(target: string) {
    if (!target || !String(target).trim()) {
      setAnalysisError("Please provide a topic to analyze");
      return;
    }
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    // Use a helper to convert AbortError into a controlled timeout error
    function fetchWithTimeout(url: string, options: any = {}, ms = 15000) {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { ...options, signal: ctrl.signal })
        .catch((e) => {
          if (e && e.name === 'AbortError') throw new Error('Request timed out');
          throw e;
        })
        .finally(() => clearTimeout(id));
    }

    try {
      const apiUrl = `${window.location.origin}/api/agent/run`;
      const resp = await fetchWithTimeout(apiUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: target }),
      }, 15000);

      const text = await resp.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = { ok: resp.ok, raw: text };
      }
      if (!resp.ok) {
        setAnalysisError(json.error || `Agent failed: ${resp.status}`);
        return;
      }
      const result = json.data || json.raw || json;

      // If server signaled Flowise fallback, surface a UI toast
      if (json.flowise_fallback) {
        const desc = json.flowise_error
          ? String(json.flowise_error).slice(0, 300)
          : "Flowise unavailable — using rule-based fallback";
        try {
          toast({
            title: "Flowise unavailable — using fallback",
            description: desc,
          });
        } catch (e) {
          // ignore if toast system not initialized
        }
      }

      setAnalysisResult(result);
      setAnalysisMeta({ posts: json.posts, clusters: json.clusters });
      const score =
        result && typeof result === "object"
          ? (result.score ?? result?.score)
          : null;
      const action = result?.action ?? null;
      const histItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        topic: target,
        score,
        action,
        raw: result,
      };
      pushHistory(histItem);
      setLastRunTs(Date.now());
    } catch (err: any) {
      const isAbort = err?.name === "AbortError";
      const msg = isAbort ? "Request timed out" : (err?.message ?? String(err));
      if (!isAbort) console.error("runAnalysis error", err);
      if (
        msg === "Failed to fetch" ||
        msg.includes("NetworkError") ||
        msg.includes("fetch")
      ) {
        setAnalysisError(
          "Network error: failed to reach server. Check that the backend is running and reachable.",
        );
      } else {
        setAnalysisError(msg);
      }
    } finally {
      setAnalysisLoading(false);
    }
  }

  function tryStartAnalysis(target: string) {
    const now = Date.now();
    const diff = now - lastRunTs;
    const LIMIT_MS = 15000; // 15s
    if (diff < LIMIT_MS) {
      setAnalysisError(
        `Rate limit: please wait ${Math.ceil((LIMIT_MS - diff) / 1000)}s before next analysis`,
      );
      return;
    }
    setPendingTarget(target);
    setShowConfirm(true);
  }

  async function confirmAndRun() {
    if (!pendingTarget) {
      setShowConfirm(false);
      return;
    }
    setShowConfirm(false);
    await runAnalysis(pendingTarget);
    setPendingTarget(null);
  }

  const filtered: TrendTopic[] = useMemo(() => {
    let base = sortedTopics;
    if (category !== "All")
      base = base.filter((t) => classifyCategory(t.name) === category);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      base = base.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.keywords.some((k) => k.toLowerCase().includes(q)),
      );
    }
    return base;
  }, [sortedTopics, query, category]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="text-xs uppercase tracking-[0.3em] text-foreground/60">
          Project: Membit Pulse — Cypherpunk Edition
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold glow-cyan">
          AI Dashboard for Real-Time Trends
        </h1>
      </div>

      <Filters
        query={query}
        category={category}
        onQueryChange={setQuery}
        onCategoryChange={setCategory}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TrendStream topics={filtered} />
          <LatestMembitPosts />
          <TrendingClusters />
        </div>
        <div className="lg:col-span-1 space-y-6">
          {data && <CPIGauge value={data.cpi.cpi} />}
          {data && <SentimentChart data={data.sentiment} />}
          <AnalysisHistory
            items={history.map((h) => ({
              id: h.id,
              ts: h.ts,
              topic: h.topic,
              score: h.score,
              action: h.action,
            }))}
            onClear={clearHistory}
          />
        </div>
      </div>

      <ViralPanel topics={filtered} />

      <div className="rounded-2xl border border-cyan-400/30 bg-[#0f0f0f]/80 neon-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm tracking-wide text-foreground/70">
              Run Viral Analysis
            </div>
            <div className="text-xs text-foreground/60">
              Analyze a topic using Membit data + LLM prediction
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const target = query.trim() || filtered[0]?.name || "";
                tryStartAnalysis(target);
              }}
              disabled={analysisLoading}
              className="px-4 py-2 rounded-xl border border-cyan-400/40 glow-cyan hover:bg-primary/10 disabled:opacity-50"
            >
              Run Analysis
            </button>
            <ConfirmModal
              open={showConfirm}
              title="Run Viral Analysis"
              description={
                pendingTarget
                  ? `Run analysis for: ${pendingTarget}?`
                  : undefined
              }
              onConfirm={confirmAndRun}
              onCancel={() => {
                setShowConfirm(false);
                setPendingTarget(null);
              }}
            />
          </div>
        </div>

        <div className="mt-4">
          {analysisLoading && <LoadingSkeleton />}
          {analysisError && (
            <div className="text-sm text-secondary">{analysisError}</div>
          )}
          {analysisResult && (
            <AgentResultCard result={analysisResult} meta={analysisMeta} />
          )}
        </div>
      </div>

      {/* Flowise assistant widget below the Run Viral Analysis panel */}
      <FlowiseWidget meta={analysisMeta} />

      {loading && (
        <div className="text-sm text-foreground/60">
          Loading real-time data…
        </div>
      )}
      {error && (
        <div className="text-sm text-secondary">
          Failed to load latest trends. Showing cached/mock data.
        </div>
      )}
    </div>
  );
}
