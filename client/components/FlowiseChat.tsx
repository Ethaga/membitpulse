import React, { useEffect, useState } from "react";

export default function FlowiseChat({ meta }: { meta?: any }) {
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([
    { role: "assistant", text: "Connected to Membit Flowise assistant. Ask about the posts or clusters shown above." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If meta posts exist, inject a system message summarizing count
    if (meta?.posts) {
      setMessages((m) => [
        ...m,
        { role: "system", text: `Context: ${Array.isArray(meta.posts) ? meta.posts.length + ' posts' : 'posts available'}` },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(msg: string) {
    if (!msg) return;
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
      const text = await resp.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = { raw: text };
      }
      // Attempt to extract sensible reply
      let reply = "(no reply)";
      if (json?.data) reply = typeof json.data === 'string' ? json.data : JSON.stringify(json.data);
      else if (json?.result) reply = JSON.stringify(json.result);
      else if (json?.output) reply = JSON.stringify(json.output);
      else if (json?.raw) reply = json.raw;
      else if (typeof json === 'string') reply = json;
      
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch (err: any) {
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${err?.message ?? String(err)}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 text-xs text-foreground/60">
      <div className="border rounded-md bg-[#070707] p-2 max-h-40 overflow-auto text-xs space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={"p-1 " + (m.role === 'user' ? 'text-primary' : m.role === 'system' ? 'text-foreground/60' : 'text-foreground')}>{m.role === 'user' ? 'You: ' : m.role === 'assistant' ? 'Bot: ' : 'Sys: '}{m.text}</div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 px-3 py-2 rounded-md bg-[#050505] border border-cyan-400/20 text-sm" placeholder="Ask the Membit agent about these posts..." />
        <button disabled={loading} onClick={() => send(input)} className="px-3 py-2 rounded-md bg-primary/20 border border-primary/30 text-sm">Send</button>
      </div>
    </div>
  );
}
