import type { SimulationRun } from "@chip-sim/simulation-results";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectService } from "./project";

const validBoard = `
version: 1
name: IPC divider
components:
  supply: { type: foundation.dc_voltage_source, parameters: { voltage: 9 V } }
  load: { type: foundation.resistor, parameters: { resistance: 1 kohm } }
  reference: { type: foundation.ground }
connections:
  - [supply.positive, rail]
  - [supply.negative, ground]
  - [load.positive, rail]
  - [load.negative, ground]
  - [reference.reference, ground]
`;

const transient = {
  id: "startup",
  type: "transient" as const,
  stepSeconds: 0.00001,
  stopSeconds: 0.0001,
  probes: [{ id: "rail", kind: "voltage" as const, target: "rail" }],
};

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  ),
);

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "chip-sim-project-"));
  roots.push(root);
  await mkdir(join(root, "simulations"));
  await writeFile(join(root, "board.yaml"), validBoard);
  return root;
}

describe("ProjectService", () => {
  it("opens, reads, validates, atomically saves, and runs a project", async () => {
    const root = await fixture();
    const completed: SimulationRun = {
      id: "run-1",
      analysisId: "startup",
      status: "completed",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      dataset: {
        axis: { id: "time", label: "time", unit: "s", values: [0, 1] },
        signals: [
          {
            id: "rail",
            expression: "v(n_rail)",
            unit: "V",
            values: [9, 9],
            minimum: 9,
            maximum: 9,
          },
        ],
        sampleCount: 2,
      },
    };
    const service = new ProjectService({
      executablePath: "/unused",
      runner: async () => completed,
    });

    const opened = await service.openProject(root);
    expect(opened.source).toContain("9 V");
    expect((await service.validateBoard(opened.source)).ok).toBe(true);

    await service.saveBoard(opened.source.replace("9 V", "6 V"));
    expect(await readFile(join(root, "board.yaml"), "utf8")).toContain("6 V");

    expect((await service.runSimulation(transient)).status).toBe("completed");
    expect(service.lastSuccessfulRun?.id).toBe("run-1");
  });

  it("rejects traversal outside the open project", async () => {
    const root = await fixture();
    const service = new ProjectService({ executablePath: "/unused" });
    await service.openProject(root);
    await expect(service.readProjectFile("../secret.txt")).rejects.toThrow(
      "outside the project",
    );
  });

  it("cancels an active run and preserves the last successful run after failure", async () => {
    const root = await fixture();
    let invocation = 0;
    const service = new ProjectService({
      executablePath: "/unused",
      runner: async ({ signal, analysisId }) => {
        invocation += 1;
        if (invocation === 1) {
          return {
            id: "good",
            analysisId,
            status: "completed",
            startedAt: "now",
            completedAt: "now",
          };
        }
        await new Promise<void>((resolve) =>
          signal?.addEventListener("abort", () => resolve(), { once: true }),
        );
        return {
          id: "cancelled",
          analysisId,
          status: "cancelled",
          startedAt: "now",
          completedAt: "now",
        };
      },
    });
    await service.openProject(root);
    await service.runSimulation(transient);
    const active = service.runSimulation(transient);
    service.cancelSimulation();
    expect((await active).status).toBe("cancelled");
    expect(service.lastSuccessfulRun?.id).toBe("good");
  });
});
