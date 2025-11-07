import React, { useEffect, useRef, useState } from "react";

export default function FlowiseChat({ meta }: { meta?: any }) {
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([
    { role: "assistant", text: "Connected to Membit Flowise assistant. Ask about the posts or clusters shown above." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [configOk, setConfigOk] = useState<boolean | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/flowise/config");
        const j = await r.json();
        setConfigOk(!!j?.urlConfigured);
      } catch (e) {
        setConfigOk(false);
      }
    })();
    // If meta posts exist, inject a system message summarizing count
    if (meta?.posts) {
      setMessages((m) => [
        ...m,
        { role: "system", text: `Context: ${Array.isArray(meta.posts) ? meta.posts.length + ' posts' : 'posts available'}` },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // scroll to bottom on new message
    if (scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [messages]);

  async function send(msg: string) {
    if (!msg) return;
    if (configOk === false) {
      setMessages((m) => [...m, { role: "assistant", text: "FLOWISE_API_URL not configured" }]);
      return;
    }
    const userMsg = { role: "user", text: msg };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const resp = await fetch("/api/flowise/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: msg, meta }),
      });

      if (!resp.ok) {
        // server returned 500 or similar
        setMessages((m) => [...m, { role: "assistant", text: "⚠️ Connection error, check Flowise config" }]);
        return;
      }

      const text = await resp.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = { raw: text };
      }

      // Best-effort extraction of reply
      let reply = "(no reply)";
      if (typeof json === 'string') reply = json;
      else if (json?.answer) reply = json.answer;
      else if (json?.data && typeof json.data === 'string') reply = json.data;
      else if (json?.data && typeof json.data === 'object') reply = JSON.stringify(json.data);
      else if (json?.output) reply = typeof json.output === 'string' ? json.output : JSON.stringify(json.output);
      else if (json?.result) reply = typeof json.result === 'string' ? json.result : JSON.stringify(json.result);
      else if (json?.raw) reply = json.raw;

      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch (err: any) {
      const msgText = String(err?.message ?? err);
      if (msgText.includes('body stream') || msgText.includes('already read')) {
        setMessages((m) => [...m, { role: "assistant", text: "⚠️ Connection error, check Flowise config" }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", text: `Error: ${msgText}` }]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 text-xs text-foreground/60">
      {configOk === false && (
        <div className="p-3 rounded-md bg-[#1b0f0f] border border-red-600/30 text-sm">FLOWISE_API_URL not configured</div>
      )}

      <div ref={scroller} className="border rounded-md bg-[#070707] p-3 max-h-56 overflow-auto text-xs space-y-3 neon-border">
        {messages.map((m, i) => (
          <div key={i} className={`max-w-full break-words p-2 rounded-md ${m.role === 'user' ? 'ml-auto bg-gradient-to-r from-cyan-700/30 to-cyan-900/20 text-right border border-cyan-400/30' : m.role === 'system' ? 'bg-[#0b0b0b] text-foreground/60 border border-foreground/10' : 'bg-[#061216] border border-cyan-400/10'}`}>
            <div className="text-[11px] font-semibold mb-1">{m.role === 'user' ? 'You' : m.role === 'assistant' ? 'Flowise' : 'System'}</div>
            <div className="text-sm leading-snug">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-3 py-2 rounded-md bg-[#050505] border border-cyan-400/20 text-sm"
          placeholder="Ask the Flowise assistant..."
        />
        <button disabled={loading} onClick={() => send(input)} className="px-4 py-2 rounded-md bg-cyan-600/10 border border-cyan-400/30 text-sm">Send</button>
      </div>
    </div>
  );
}
