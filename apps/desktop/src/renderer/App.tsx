import { BoardEditor } from "./components/BoardEditor";
import { CircuitDiagram } from "./components/CircuitDiagram";
import { Inspector } from "./components/Inspector";
import { SimulationToolbar } from "./components/SimulationToolbar";
import { WaveformPlot } from "./components/WaveformPlot";
import { useWorkstation } from "./state/use-workstation";
import "./app.css";

export function App() {
  const { state, openProject, save, run, cancel, setSource, select } = useWorkstation();
  const running = state.activeRun?.status === "running" || state.activeRun?.status === "compiling";
  const hasErrors = state.diagnostics.some((diagnostic) => diagnostic.severity === "error");

  return (
    <main className="workstation">
      <header className="titlebar">
        <div className="brand-mark">CS</div>
        <div><h1>Chip Sim Workstation</h1><p>{state.projectPath ?? "Local circuit modeling and SPICE analysis"}</p></div>
        <div className="title-actions">
          {state.dirty && <span className="dirty-badge">Unsaved</span>}
          <button onClick={() => void openProject()}>Open project</button>
          <button disabled={!state.projectPath || !state.dirty} onClick={() => void save()}>Save</button>
        </div>
      </header>

      {!state.projectPath ? (
        <section className="welcome">
          <div className="welcome-card">
            <span className="eyebrow">LOCAL-FIRST ENGINEERING</span>
            <h2>Turn a board description into an executable electrical model.</h2>
            <p>Edit physical parameters, validate connectivity, run the bundled ngspice solver, and compare waveforms without touching the physical board.</p>
            <button className="primary" onClick={() => void openProject()}>Open a project folder</button>
            <small>A project folder starts with <code>board.yaml</code>. Nothing is uploaded.</small>
          </div>
        </section>
      ) : (
        <>
          <SimulationToolbar disabled={hasErrors || !state.circuit} running={running} onRun={(kind) => void run(kind)} onCancel={() => void cancel()} />
          <div className="workspace-grid">
            <aside className="project-panel panel">
              <div className="panel-heading"><span>PROJECT</span><strong>{state.projectName}</strong></div>
              <button className="file active">◇ board.yaml</button>
              <div className="section-label">MODEL</div>
              <dl>
                <div><dt>Components</dt><dd>{state.circuit?.components.length ?? "—"}</dd></div>
                <div><dt>Nets</dt><dd>{state.circuit?.nets.length ?? "—"}</dd></div>
                <div><dt>Diagnostics</dt><dd className={hasErrors ? "bad" : "good"}>{state.diagnostics.length}</dd></div>
              </dl>
            </aside>
            <section className="editor-panel panel">
              <div className="panel-heading"><span>BOARD SOURCE</span><span>{state.validating ? "Validating…" : hasErrors ? "Needs attention" : "Model valid"}</span></div>
              <BoardEditor source={state.source} onChange={setSource} />
            </section>
            <section className="diagram-panel panel">
              <div className="panel-heading"><span>CIRCUIT TOPOLOGY</span><span>Executable view</span></div>
              <CircuitDiagram circuit={state.circuit} onSelect={select} />
            </section>
            <section className="results-panel panel">
              <div className="panel-heading"><span>WAVEFORMS</span><span>{state.activeRun?.status ?? "Ready"}</span></div>
              <WaveformPlot dataset={state.lastSuccessfulRun?.dataset} />
            </section>
          </div>
          <Inspector diagnostics={state.diagnostics} run={state.activeRun} selected={state.selectedEntity} />
        </>
      )}
    </main>
  );
}
