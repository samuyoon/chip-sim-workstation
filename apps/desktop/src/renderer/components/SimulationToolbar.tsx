import { useState } from "react";

export function SimulationToolbar({
  disabled,
  running,
  onRun,
  onCancel
}: {
  disabled: boolean;
  running: boolean;
  onRun(kind: "operating_point" | "dc_sweep" | "transient"): void;
  onCancel(): void;
}) {
  const [kind, setKind] = useState<"operating_point" | "dc_sweep" | "transient">("transient");
  return (
    <div className="simulation-toolbar">
      <label>
        Analysis
        <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="transient">Startup transient</option>
          <option value="operating_point">Operating point</option>
          <option value="dc_sweep">Supply sweep (6–12 V)</option>
        </select>
      </label>
      <button className="run-button" disabled={disabled || running} onClick={() => onRun(kind)}>▶ Run</button>
      <button disabled={!running} onClick={onCancel}>Cancel</button>
    </div>
  );
}
