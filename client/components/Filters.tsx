import { cn } from "@/lib/utils";
import { useMemo } from "react";

export type Category = "All" | "AI" | "Crypto" | "Politics" | "Tech" | "Bio" | "Other";

export interface FiltersProps {
  className?: string;
  query: string;
  category: Category;
  onQueryChange: (q: string) => void;
  onCategoryChange: (c: Category) => void;
}

const CATEGORIES: Category[] = ["All", "AI", "Crypto", "Politics", "Tech", "Bio", "Other"];

export function Filters({ className, query, category, onQueryChange, onCategoryChange }: FiltersProps) {
  const catOpts = useMemo(() => CATEGORIES, []);

  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-center md:justify-between", className)}>
      <div className="relative flex-1">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search topics, keywords, #hashtags…"
          className="w-full rounded-2xl bg-card/70 border border-cyan-400/30 px-4 py-3 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary neon-border"
        />
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-primary/70">⌕</div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs uppercase tracking-widest text-foreground/60">Category</label>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as Category)}
          className="rounded-2xl bg-card/70 border border-cyan-400/30 px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-secondary neon-border"
        >
          {catOpts.map((c) => (
            <option key={c} value={c} className="bg-[#0f0f0f] text-foreground">
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
export default Filters;
