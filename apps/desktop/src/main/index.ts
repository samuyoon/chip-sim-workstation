import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { z } from "zod";
import { ProjectService } from "./project";

const probeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["voltage", "current"]),
  target: z.string().min(1),
});
const analysisSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("operating_point"),
    probes: z.array(probeSchema),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("dc_sweep"),
    sourceComponentId: z.string().min(1),
    start: z.number().finite(),
    stop: z.number().finite(),
    step: z.number().positive(),
    probes: z.array(probeSchema),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("transient"),
    stepSeconds: z.number().positive(),
    stopSeconds: z.number().positive(),
    probes: z.array(probeSchema),
  }),
]);

const solverPath = app.isPackaged
  ? join(process.resourcesPath, "ngspice/darwin-arm64/ngspice")
  : join(app.getAppPath(), "resources/ngspice/darwin-arm64/ngspice");
const projectService = new ProjectService({
  executablePath: solverPath,
  onRunUpdate: (run) =>
    BrowserWindow.getAllWindows().forEach((window) =>
      window.webContents.send("simulation:update", run),
    ),
});

ipcMain.handle("project:open", async () => {
  const selection = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Open circuit project",
  });
  if (selection.canceled || !selection.filePaths[0]) return null;
  return projectService.openProject(selection.filePaths[0]);
});
ipcMain.handle("project:read-board", () => projectService.readBoard());
ipcMain.handle("project:save-board", (_event, source: unknown) => {
  if (typeof source !== "string") throw new Error("Board source must be text");
  return projectService.saveBoard(source);
});
ipcMain.handle("project:validate-board", (_event, source: unknown) => {
  if (typeof source !== "string") throw new Error("Board source must be text");
  return projectService.validateBoard(source);
});
ipcMain.handle("simulation:run", (_event, input: unknown) =>
  projectService.runSimulation(analysisSchema.parse(input)),
);
ipcMain.handle("simulation:cancel", () => projectService.cancelSimulation());

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

void app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
