import React from "react";

export default function ConfirmModal({ open, title, description, onConfirm, onCancel }: { open: boolean; title: string; description?: string; onConfirm: () => void; onCancel: () => void; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative max-w-lg w-full p-6 rounded-2xl bg-[#0f0f0f] border border-cyan-400/20 neon-border">
        <h3 className="text-lg font-semibold glow-cyan">{title}</h3>
        {description && <p className="text-sm text-foreground/70 mt-2">{description}</p>}
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-md border border-cyan-400/20 text-foreground/70">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground glow-magenta">Confirm</button>
        </div>
      </div>
    </div>
  );
}
