import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange(value: string): void }) => (
    <textarea aria-label="Board YAML" value={value} onChange={(event) => onChange(event.target.value)} />
  )
}));
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes }: { nodes: Array<{ id: string }> }) => <div aria-label="Circuit topology">{nodes.map((node) => node.id).join(", ")}</div>,
  Background: () => null,
  Controls: () => null
}));
vi.mock("uplot", () => ({ default: class { destroy() {} } }));

const source = `version: 1
name: Demo
components:
  supply: { type: foundation.dc_voltage_source, parameters: { voltage: 9 V } }
  load: { type: foundation.resistor, parameters: { resistance: 1 kohm } }
  reference: { type: foundation.ground }
connections:
  - [supply.positive, rail]
  - [supply.negative, ground]
  - [load.positive, rail]
  - [load.negative, ground]
  - [reference.reference, ground]`;

describe("App", () => {
  beforeEach(() => {
    window.chipSim = {
      openProject: vi.fn().mockResolvedValue({ rootPath: "/tmp/demo", name: "Demo", source }),
      readBoard: vi.fn().mockResolvedValue(source),
      saveBoard: vi.fn().mockResolvedValue(undefined),
      validateBoard: vi.fn().mockResolvedValue({
        ok: true,
        diagnostics: [],
        circuit: { name: "Demo", components: [], nets: [{ name: "rail", connections: [] }] }
      }),
      runSimulation: vi.fn().mockResolvedValue({ id: "run", analysisId: "operating-point", status: "completed", startedAt: "now" }),
      cancelSimulation: vi.fn().mockResolvedValue(undefined),
      onRunUpdate: vi.fn().mockReturnValue(() => undefined)
    };
  });

  it("opens a local project and tracks source edits", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Chip Sim Workstation" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open project" }));
    const editor = await screen.findByRole("textbox", { name: "Board YAML" });
    expect((editor as HTMLTextAreaElement).value).toContain("9 V");
    fireEvent.change(editor, { target: { value: source.replace("9 V", "6 V") } });
    expect(screen.getByText("Unsaved")).toBeVisible();
    await waitFor(() => expect(window.chipSim.validateBoard).toHaveBeenCalled());
  });
});
