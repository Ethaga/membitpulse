import React from "react";
import { cn } from "@/lib/utils";

export interface AgentResultCardProps {
  result: any;
  meta?: { posts?: any; clusters?: any } | null;
}

function actionClass(action?: string) {
  if (!action) return "bg-foreground/10 text-foreground/80";
  if (action.toLowerCase() === "amplify") return "bg-secondary/10 text-secondary glow-magenta border border-secondary/30";
  if (action.toLowerCase() === "monitor") return "bg-primary/10 text-primary glow-cyan border border-primary/30";
  return "bg-foreground/10 text-foreground/70";
}

export default function AgentResultCard({ result, meta }: AgentResultCardProps) {
  const parsed = (result && typeof result === "object") ? result : (typeof result === 'string' ? (() => {
    try { return JSON.parse(result); } catch { return { raw: result }; }
  })() : { raw: result });

  const score = typeof parsed?.score === 'number' ? parsed.score : (parsed?.score ? Number(parsed.score) : null);
  const rationale: string[] = Array.isArray(parsed?.rationale) ? parsed.rationale : (parsed?.rationale ? [parsed.rationale].flat().slice(0,3) : []);
  const action = parsed?.action || (parsed?.recommendation) || null;
  const explanation = parsed?.explanation || parsed?.raw || null;

  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-[#0f0f0f]/80 neon-border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center justify-center w-28 h-28 rounded-full bg-[#070707] neon-border">
            <div className="text-xs text-foreground/70">Viral Score</div>
            <div className={"text-3xl font-extrabold mt-1 " + (score >= 80 ? 'text-secondary glow-magenta' : score >=50 ? 'text-primary glow-cyan' : 'text-foreground/80') }>
              {score !== null ? Math.round(score) : "--"}
            </div>
            <div className="text-xs text-foreground/60">/100</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Analysis</div>
            <div className="text-xs text-foreground/60 max-w-xl">Summary based on recent Membit context (posts, clusters, sentiment, volume)</div>

            <div className="mt-3 space-y-2">
              {rationale.length > 0 ? (
                rationale.slice(0,3).map((r, i) => (
                  <div key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                    <div className="mt-1 text-primary">•</div>
                    <div>{r}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-foreground/70">No rationale returned by model.</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className={cn("px-3 py-1 rounded-full text-xs font-semibold", actionClass(action))}>{action ? action : 'Unknown'}</div>
          {explanation && <div className="text-xs text-foreground/60 max-w-xs text-right">{typeof explanation === 'string' ? explanation.slice(0,200) : JSON.stringify(explanation).slice(0,200)}</div>}
        </div>
      </div>

      {meta?.posts && (
        <details className="mt-3 text-xs text-foreground/60">
          <summary className="cursor-pointer">View source posts (sample)</summary>
          <pre className="mt-2 max-h-40 overflow-auto p-2 bg-[#070707] rounded-md text-xs text-foreground/80">{JSON.stringify(meta.posts, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
