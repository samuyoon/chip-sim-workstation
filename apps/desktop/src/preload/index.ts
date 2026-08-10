import type { SimulationRun } from "@chip-sim/simulation-results";
import { contextBridge, ipcRenderer } from "electron";
import type { ChipSimBridge, RunRequest } from "../shared/ipc";

const bridge: ChipSimBridge = Object.freeze({
  openProject: () => ipcRenderer.invoke("project:open"),
  readBoard: () => ipcRenderer.invoke("project:read-board"),
  saveBoard: (source: string) => ipcRenderer.invoke("project:save-board", source),
  validateBoard: (source: string) => ipcRenderer.invoke("project:validate-board", source),
  runSimulation: (request: RunRequest) => ipcRenderer.invoke("simulation:run", request),
  cancelSimulation: () => ipcRenderer.invoke("simulation:cancel"),
  onRunUpdate: (listener: (run: SimulationRun) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, run: SimulationRun) => listener(run);
    ipcRenderer.on("simulation:update", handler);
    return () => ipcRenderer.removeListener("simulation:update", handler);
  }
});

contextBridge.exposeInMainWorld("chipSim", bridge);
