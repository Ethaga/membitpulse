import { RequestHandler } from "express";
import type { TrendResponse, TrendTopic, SentimentBreakdown, CPIResponse } from "@shared/api";

// Simple helpers for mock data
const sampleTopics = [
  "AI Governance", "Post-Quantum Crypto", "DeFi Liquidity", "Election Misinformation",
  "Generative Agents", "Layer-2 Rollups", "Digital ID", "Privacy Coins",
  "Neural Radiance Fields", "GPU Shortage", "Memetic Warfare", "Biohacking"
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function mockTrends(count = 12): TrendTopic[] {
  return Array.from({ length: count }).map((_, i) => {
    const mentions = Math.floor(randomBetween(200, 12000));
    const growth24h = parseFloat(randomBetween(-10, 180).toFixed(2));
    const sentiment = parseFloat(randomBetween(-1, 1).toFixed(2)); // -1..1
    const name = sampleTopics[(i + Math.floor(Math.random() * sampleTopics.length)) % sampleTopics.length];
    const keywords = ["ai", "crypto", "policy", "infra", "memes", "security", "eth", "btc", "llm", "startups"]
      .sort(() => 0.5 - Math.random())
      .slice(0, 4);

    const spark: number[] = Array.from({ length: 16 }).map(() => Math.floor(randomBetween(20, 100)));

    const viralScoreRaw = Math.max(0,
      0.55 * normalize(mentions, 0, 12000) * 100 +
      0.35 * normalize(growth24h, -10, 180) * 100 +
      0.10 * normalize((sentiment + 1) / 2, 0, 1) * 100
    );
    const viralScore = Math.min(100, Math.round(viralScoreRaw));

    return { id: `${name}-${i}`, name, mentions, growth24h, sentiment, keywords, spark, viralScore };
  }).sort((a, b) => b.mentions - a.mentions);
}

function normalize(v: number, min: number, max: number) {
  if (max === min) return 0;
  return (v - min) / (max - min);
}

function computeSentiment(topics: TrendTopic[]): SentimentBreakdown {
  const totals = topics.reduce(
    (acc, t) => {
      if (t.sentiment > 0.1) acc.positive += 1;
      else if (t.sentiment < -0.1) acc.negative += 1;
      else acc.neutral += 1;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0 },
  );
  const total = Math.max(1, topics.length);
  return {
    positive: Math.round((totals.positive / total) * 100),
    neutral: Math.round((totals.neutral / total) * 100),
    negative: Math.round((totals.negative / total) * 100),
  };
}

function computeCPI(topics: TrendTopic[]): CPIResponse {
  const totalMentions = topics.reduce((a, t) => a + t.mentions, 0);
  const avgGrowth = topics.reduce((a, t) => a + t.growth24h, 0) / Math.max(1, topics.length);
  const avgSent = topics.reduce((a, t) => a + t.sentiment, 0) / Math.max(1, topics.length);

  // CPI combines volume (log scale), growth, and sentiment
  const volumeScore = Math.min(1, Math.log10(Math.max(10, totalMentions)) / 5);
  const growthScore = normalize(avgGrowth, -10, 150);
  const sentScore = (avgSent + 1) / 2; // -1..1 => 0..1

  const score = Math.round((0.6 * volumeScore + 0.3 * growthScore + 0.1 * sentScore) * 100);
  return { cpi: Math.max(0, Math.min(100, score)), totalMentions, avgGrowth: parseFloat(avgGrowth.toFixed(2)), avgSentiment: parseFloat(avgSent.toFixed(2)) };
}

export const membitTrends: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.MEMBIT_API_KEY;
    if (!apiKey) {
      console.error('/api/membit/trends error: MEMBIT_API_KEY not configured');
      return res.status(500).json({ error: 'MEMBIT_API_KEY not configured on server' });
    }

    // Prefer calling direct Membit REST API for trends
    const url = 'https://api.membit.ai/v1/trends';
    const resp = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error('/api/membit/trends remote error', resp.status, text);
      return res.status(502).json({ error: `Membit API error ${resp.status}: ${text}` });
    }

    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error('/api/membit/trends parse error', e, text);
      return res.status(502).json({ error: 'Invalid JSON from Membit API', raw: text });
    }

    // Expecting either json.topics or json.results or json.data
    const rawTopics = json.topics ?? json.results ?? json.data ?? json;
    if (!Array.isArray(rawTopics)) {
      console.error('/api/membit/trends unexpected response shape', rawTopics);
      return res.status(502).json({ error: 'Unexpected response from Membit API', raw: rawTopics });
    }

    // Map raw topics to TrendTopic shape if needed
    const topics: TrendTopic[] = rawTopics.map((t: any, i: number) => ({
      id: t.id ?? t.name ?? `topic-${i}`,
      name: t.name ?? t.title ?? (typeof t === 'string' ? t : `topic-${i}`),
      mentions: t.mentions ?? t.metric ?? 0,
      growth24h: t.growth24h ?? t.change24h ?? t.growth ?? 0,
      sentiment: typeof t.sentiment === 'number' ? t.sentiment : (t.sent ?? 0),
      keywords: Array.isArray(t.keywords) ? t.keywords : (t.tags ?? []).slice(0, 6),
      spark: Array.isArray(t.spark) ? t.spark : (t.series ?? []).slice(0, 16).map((v: any) => Number(v) || 0),
      viralScore: t.viralScore ?? t.score ?? 0,
    }));

    const sentiment = computeSentiment(topics);
    const cpi = computeCPI(topics);

    const response: TrendResponse = { topics, sentiment, cpi, ts: Date.now() };
    res.status(200).json(response);
  } catch (err) {
    console.error('/api/membit/trends error', err);
    res.status(500).json({ error: String(err) });
  }
};
