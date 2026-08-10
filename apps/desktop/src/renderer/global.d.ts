import type { ChipSimBridge } from "../shared/ipc";

declare global {
  interface Window {
    chipSim: ChipSimBridge;
  }
}

export {};
