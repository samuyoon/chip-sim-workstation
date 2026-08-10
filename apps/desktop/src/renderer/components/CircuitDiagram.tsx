import type { CanonicalCircuit } from "@chip-sim/circuit-core";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export function CircuitDiagram({ circuit, onSelect }: { circuit: CanonicalCircuit | undefined; onSelect(id: string): void }) {
  const components = circuit?.components ?? [];
  const nets = circuit?.nets ?? [];
  const nodes: Node[] = [
    ...components.map((component, index) => ({
      id: component.id,
      position: { x: 60, y: 40 + index * 86 },
      data: { label: component.definition.name },
      style: { background: "#172239", color: "#eef5ff", border: "1px solid #344a6c", borderRadius: 8, width: 155 }
    })),
    ...nets.map((net, index) => ({
      id: `net:${net.name}`,
      position: { x: 330, y: 40 + index * 86 },
      data: { label: net.name },
      style: { background: "#12322f", color: "#bff8e8", border: "1px solid #27766c", borderRadius: 999, width: 120 }
    }))
  ];
  const edges: Edge[] = nets.flatMap((net) =>
    net.connections.map((connection, index) => ({
      id: `${connection.componentId}-${net.name}-${index}`,
      source: connection.componentId,
      target: `net:${net.name}`,
      style: { stroke: "#58708f" }
    }))
  );
  return (
    <ReactFlow nodes={nodes} edges={edges} fitView onNodeClick={(_event, node) => onSelect(node.id)} nodesDraggable={false} nodesConnectable={false}>
      <Background color="#27364d" gap={20} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
