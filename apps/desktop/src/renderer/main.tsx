import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

loader.config({ monaco });
const workerHost = self as typeof self & {
  MonacoEnvironment: { getWorker(): Worker };
};
workerHost.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
