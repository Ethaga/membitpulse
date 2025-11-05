import React from "react";
import { createRoot, Root } from "react-dom/client";
import App from "./App";

declare global {
  interface Window { __MEMBIT_REACT_ROOT__?: Root }
}

const container = document.getElementById("root");
if (!container) throw new Error("Root container not found");

// Reuse existing root if HMR or module re-evaluation happens
let root = window.__MEMBIT_REACT_ROOT__;
if (!root) {
  root = createRoot(container);
  window.__MEMBIT_REACT_ROOT__ = root;
}

root.render(<App />);

// Accept HMR updates for React components gracefully
if ((import.meta as any).hot) {
  (import.meta as any).hot.accept();
}
