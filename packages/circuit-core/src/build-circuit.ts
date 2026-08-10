import {
  parseQuantity,
  type BoardSource,
  type Diagnostic,
} from "@chip-sim/board-schema";
import { foundationLibrary } from "@chip-sim/component-library";
import type { CircuitBuildResult } from "./types";

export function buildCircuit(board: BoardSource): CircuitBuildResult {
  const diagnostics: Diagnostic[] = [];
  const components = [];

  for (const [id, source] of Object.entries(board.components).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const definition = foundationLibrary.get(source.type);
    if (!definition) {
      diagnostics.push({
        code: "UNKNOWN_COMPONENT_TYPE",
        severity: "error",
        message: `Unknown component type '${source.type}'`,
        entityId: id,
      });
      continue;
    }

    const parameters: Record<string, ReturnType<typeof parseQuantity>> = {};
    for (const suppliedName of Object.keys(source.parameters)) {
      if (!definition.parameters[suppliedName]) {
        diagnostics.push({
          code: "UNKNOWN_PARAMETER",
          severity: "error",
          message: `Unknown parameter '${suppliedName}' on ${id}`,
          entityId: id,
        });
      }
    }

    for (const [name, parameterDefinition] of Object.entries(
      definition.parameters,
    )) {
      const raw = source.parameters[name] ?? parameterDefinition.default;
      if (typeof raw !== "string") {
        diagnostics.push({
          code: "INVALID_PARAMETER",
          severity: "error",
          message: `${id}.${name} must include a value and unit`,
          entityId: id,
        });
        continue;
      }
      try {
        const parsed = parseQuantity(raw, parameterDefinition.quantity);
        const belowMinimum =
          parameterDefinition.minimum !== undefined &&
          parsed.siValue < parameterDefinition.minimum;
        const atExclusiveMinimum =
          parameterDefinition.exclusiveMinimum === true &&
          parsed.siValue === parameterDefinition.minimum;
        if (belowMinimum || atExclusiveMinimum)
          throw new Error(`${raw} is outside the allowed range`);
        parameters[name] = parsed;
      } catch (error) {
        diagnostics.push({
          code: "INVALID_PARAMETER",
          severity: "error",
          message: `${id}.${name}: ${error instanceof Error ? error.message : String(error)}`,
          entityId: id,
        });
      }
    }
    components.push({ id, definition, parameters });
  }

  const componentMap = new Map(
    components.map((component) => [component.id, component]),
  );
  const netMap = new Map<
    string,
    Array<{ componentId: string; portId: string }>
  >();
  const connectedPorts = new Set<string>();

  for (const [endpoint, netName] of board.connections) {
    const dot = endpoint.lastIndexOf(".");
    const componentId = endpoint.slice(0, dot);
    const portId = endpoint.slice(dot + 1);
    const component = componentMap.get(componentId);
    if (!component) {
      diagnostics.push({
        code: "UNKNOWN_COMPONENT",
        severity: "error",
        message: `Unknown component '${componentId}'`,
        entityId: componentId,
      });
      continue;
    }
    if (!component.definition.ports[portId]) {
      diagnostics.push({
        code: "UNKNOWN_PORT",
        severity: "error",
        message: `Unknown port '${endpoint}'`,
        entityId: componentId,
      });
      continue;
    }
    if (connectedPorts.has(endpoint)) {
      diagnostics.push({
        code: "DUPLICATE_CONNECTION",
        severity: "error",
        message: `Port '${endpoint}' is connected more than once`,
        entityId: componentId,
      });
      continue;
    }
    connectedPorts.add(endpoint);
    const netConnections = netMap.get(netName) ?? [];
    netConnections.push({ componentId, portId });
    netMap.set(netName, netConnections);
  }

  for (const component of components) {
    for (const [portId, port] of Object.entries(component.definition.ports)) {
      if (port.required && !connectedPorts.has(`${component.id}.${portId}`)) {
        diagnostics.push({
          code: "UNCONNECTED_PORT",
          severity: "error",
          message: `Required port '${component.id}.${portId}' is unconnected`,
          entityId: component.id,
        });
      }
    }
  }

  const groundComponent = components.find(
    (component) => component.definition.implementation.device === "ground",
  );
  const groundConnected =
    groundComponent && connectedPorts.has(`${groundComponent.id}.reference`);
  if (!groundConnected) {
    diagnostics.push({
      code: "MISSING_GROUND",
      severity: "error",
      message: "Circuit requires a connected ground reference",
    });
  }

  if (diagnostics.some((item) => item.severity === "error"))
    return { ok: false, diagnostics };

  const nets = [...netMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, connections]) => ({
      name,
      connections: connections.sort((left, right) =>
        `${left.componentId}.${left.portId}`.localeCompare(
          `${right.componentId}.${right.portId}`,
        ),
      ),
    }));
  return {
    ok: true,
    circuit: { name: board.name, components, nets },
    diagnostics,
  };
}
