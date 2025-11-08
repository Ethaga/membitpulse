import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchTrends } from "@/data/membit-api";
import type { TrendResponse, TrendTopic } from "@shared/api";

export interface UseRealTimeTrendsOptions {
  intervalMs?: number; // default 60000
  immediate?: boolean;
}

export function useRealTimeTrends(opts: UseRealTimeTrendsOptions = {}) {
  const { intervalMs = 60000, immediate = true } = opts;
  const [data, setData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<number | null>(null);

  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // cleanup previous controller
      if (controllerRef.current) {
        try { controllerRef.current.abort(); } catch {}
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      const d = await fetchTrends(controller.signal);
      setData(d);
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return;
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [fetchTrends]);

  useEffect(() => {
    if (immediate) void load();
    timerRef.current = window.setInterval(() => void load(), intervalMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (controllerRef.current) {
        try { controllerRef.current.abort(); } catch {}
      }
    };
  }, [intervalMs, immediate, load]);

  const sortedTopics = useMemo<TrendTopic[]>(() => {
    return data?.topics?.slice().sort((a, b) => b.mentions - a.mentions) ?? [];
  }, [data]);

  return { data, sortedTopics, loading, error, reload: load };
}
