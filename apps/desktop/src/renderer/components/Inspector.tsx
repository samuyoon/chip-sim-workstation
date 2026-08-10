import type { Diagnostic } from "@chip-sim/board-schema";
import type { SimulationRun } from "@chip-sim/simulation-results";
import { useState } from "react";

export function Inspector({ diagnostics, run, selected }: { diagnostics: Diagnostic[]; run: SimulationRun | undefined; selected: string | undefined }) {
  const [tab, setTab] = useState<"diagnostics" | "netlist" | "log" | "provenance">("diagnostics");
  return (
    <section className="inspector panel">
      <div className="tabs">
        {(["diagnostics", "netlist", "log", "provenance"] as const).map((item) => (
          <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>
        ))}
      </div>
      <div className="inspector-content">
        {tab === "diagnostics" && (diagnostics.length ? diagnostics.map((item, index) => <p className={item.severity} key={`${item.code}-${index}`}><code>{item.code}</code> {item.message}</p>) : <p className="success">No model errors.</p>)}
        {tab === "netlist" && <pre>{run?.netlist ?? "Run an analysis to view generated SPICE."}</pre>}
        {tab === "log" && <pre>{run?.failure ? `${run.failure.classification}: ${run.failure.message}\n${run.failure.details ?? ""}` : run?.stdout || run?.stderr || "No solver log yet."}</pre>}
        {tab === "provenance" && <p>{selected ? `Selected model entity: ${selected}` : "Select a component in the topology to inspect its model provenance."}</p>}
      </div>
    </section>
  );
}
