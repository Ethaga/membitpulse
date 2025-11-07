import React from "react";
import FlowiseChat from "./FlowiseChat";

export default function FlowiseWidget({ meta }: { meta?: any }) {
  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-[#0f0f0f]/80 neon-border p-4 mt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm tracking-wide text-foreground/70">Membit Flowise Assistant</div>
          <div className="text-xs text-foreground/60">Interactive chat connected to Flowise (Membit context)</div>
        </div>
      </div>

      <div className="mt-4">
        <FlowiseChat meta={meta} />
      </div>
    </div>
  );
}
