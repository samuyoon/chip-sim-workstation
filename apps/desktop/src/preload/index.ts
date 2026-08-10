import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("chipSim", Object.freeze({}));
