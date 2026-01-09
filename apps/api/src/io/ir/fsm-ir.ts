/**
 * FSM IR generator for XState state machine diagrams.
 * Transforms state model specifications into finite state machine
 * intermediate representations for visualization and code generation.
 */
import { computeSpecHash } from "./helpers";
import type { Fsm, FsmState } from "./types";

/**
 * Generate finite state machine intermediate representation.
 * Extracts state models from various spec locations (processes, states, stateModels)
 * and converts them into FSM structures.
 * @param resolved - The resolved specification containing state model definitions
 * @returns IR data with spec hash and array of FSM definitions
 */
export function generateFsmIR(resolved: Record<string, unknown>): Record<string, unknown> {
  const stateModels =
    (resolved.processes as Record<string, any>) ||
    (resolved.states as Record<string, any>) ||
    (resolved.stateModels as Record<string, any>) ||
    {};
  const fsms: Fsm[] = [];

  Object.entries(stateModels).forEach(([fsmId, model]) => {
    const states: Record<string, FsmState> = {};

    if (model.states && typeof model.states === "object") {
      Object.entries(model.states).forEach(([stateId, state]: [string, any]) => {
        states[stateId] = {
          actions: state.actions || [],
          transitions: state.transitions || state.on || {},
        };
      });
    }

    fsms.push({
      id: fsmId,
      name: model.name || fsmId,
      initial: model.initialState || model.initial || "idle",
      states,
    });
  });

  return {
    specHash: computeSpecHash(resolved),
    fsms,
  };
}
