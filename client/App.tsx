import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground terminal-grid">
          <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-cyan-400/20">
            <div className="container flex items-center justify-between py-4">
              <div className="relative text-lg font-bold tracking-widest">
                <span className="glow-cyan">Membit Pulse</span>
                <span className="ml-2 text-secondary glow-magenta">[Cypherpunk Edition]</span>
              </div>
              <div className="text-xs text-foreground/60">Realtime AI Trend Intelligence</div>
            </div>
          </header>
          <main className="container py-6">
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="border-t border-cyan-400/20">
            <div className="container py-6 text-center text-foreground/70">
              “Decode the world’s chaos. Predict what spreads next.”
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
