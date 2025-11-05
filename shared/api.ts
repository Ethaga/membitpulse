/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

export interface TrendTopic {
  id: string;
  name: string;
  mentions: number;
  growth24h: number; // percent
  sentiment: number; // -1..1
  keywords: string[];
  spark: number[]; // for sparkline
  viralScore: number; // 0..100
}

export interface SentimentBreakdown {
  positive: number; // percentage 0..100
  neutral: number; // percentage 0..100
  negative: number; // percentage 0..100
}

export interface CPIResponse {
  cpi: number; // 0..100
  totalMentions: number;
  avgGrowth: number;
  avgSentiment: number; // -1..1
}

export interface TrendResponse {
  topics: TrendTopic[];
  sentiment: SentimentBreakdown;
  cpi: CPIResponse;
  ts: number; // timestamp
}
