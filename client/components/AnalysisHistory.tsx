import React from "react";

export interface HistoryItem {
  id: string;
  ts: number;
  topic: string;
  score?: number | null;
  action?: string | null;
  raw?: any;
}

export default function AnalysisHistory({ items, onClear }: { items: HistoryItem[]; onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-[#0f0f0f]/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-foreground">Recent Analyses</div>
        <button onClick={onClear} className="text-xs text-foreground/60 hover:text-foreground">Clear</button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-foreground/60">No previous analyses</div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between bg-[#070707] p-2 rounded-md border border-cyan-400/10">
              <div>
                <div className="text-xs font-medium text-foreground">{it.topic}</div>
                <div className="text-xxs text-foreground/60 text-xs">{new Date(it.ts).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-primary">{it.score != null ? Math.round(it.score) : '--'}</div>
                <div className="text-xs text-foreground/60">{it.action ?? '—'}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
