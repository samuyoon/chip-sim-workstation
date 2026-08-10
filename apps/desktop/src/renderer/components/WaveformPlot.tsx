import type { SimulationDataset } from "@chip-sim/simulation-results";
import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

export function WaveformPlot({ dataset }: { dataset: SimulationDataset | undefined }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dataset || !host.current) return;
    const plot = new uPlot(
      {
        width: Math.max(host.current.clientWidth, 480),
        height: Math.max(host.current.clientHeight, 220),
        cursor: { drag: { x: true, y: false } },
        scales: { x: { time: false } },
        axes: [{ stroke: "#8191aa", grid: { stroke: "#26344a" } }, { stroke: "#8191aa", grid: { stroke: "#26344a" } }],
        series: [
          { label: dataset.axis.label },
          ...dataset.signals.map((signal, index) => ({
            label: `${signal.id} (${signal.unit})`,
            stroke: ["#62e6bf", "#70a7ff", "#f6c760", "#ee7fa8"][index % 4]!,
            width: 2
          }))
        ]
      },
      [dataset.axis.values, ...dataset.signals.map((signal) => signal.values)] as uPlot.AlignedData,
      host.current
    );
    return () => plot.destroy();
  }, [dataset]);

  if (!dataset) return <div className="empty-state">Run a simulation to inspect electrical behavior.</div>;
  return <div className="plot-host" ref={host} />;
}
