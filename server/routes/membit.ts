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
    // If an API key is configured, you can call the real Membit API here.
    // Fallback to mock if not configured or on failure.
    let topics: TrendTopic[];

    if (apiKey) {
      // Example placeholder for real implementation:
      // const resp = await fetch("https://api.membit.ai/v1/trends", { headers: { Authorization: `Bearer ${apiKey}` } });
      // const json = await resp.json();
      // topics = mapRealApi(json);
      topics = mockTrends(12);
    } else {
      topics = mockTrends(12);
    }

    const sentiment = computeSentiment(topics);
    const cpi = computeCPI(topics);

    const response: TrendResponse = { topics, sentiment, cpi, ts: Date.now() };
    res.status(200).json(response);
  } catch (err) {
    console.error("/api/membit/trends error", err);
    res.status(200).json({ topics: mockTrends(10), sentiment: computeSentiment(mockTrends(10)), cpi: computeCPI(mockTrends(10)), ts: Date.now() });
  }
};
