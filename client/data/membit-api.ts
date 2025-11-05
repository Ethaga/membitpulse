import type { TrendResponse } from "@shared/api";

export async function fetchTrends(signal?: AbortSignal): Promise<TrendResponse> {
  const res = await fetch("/api/membit/trends", { signal, headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`Failed to fetch trends: ${res.status}`);
  const json = (await res.json()) as TrendResponse;
  return json;
}
