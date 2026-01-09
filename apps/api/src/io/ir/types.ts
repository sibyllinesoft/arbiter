/**
 * Type definitions for Intermediate Representation (IR) structures.
 * These types define the data structures used for diagram and visualization generation.
 */

/** Base node representation in the IR graph */
export interface IRNode {
  /** Unique identifier for the node */
  id: string;
  /** Display label for the node */
  label: string;
  /** Node type classification (e.g., service, database, endpoint) */
  type: string;
  /** Optional domain grouping for the node */
  domain?: string;
  /** Additional properties attached to the node */
  properties?: Record<string, any>;
}

/** Edge connection between nodes in the IR graph */
export interface IREdge {
  /** Source node ID (primary field) */
  source: string;
  /** Target node ID (primary field) */
  target: string;
  /** Alternative source node ID */
  from?: string;
  /** Alternative target node ID */
  to?: string;
  /** Edge type classification (e.g., depends, calls, extends) */
  type: string;
  /** Optional display label for the edge */
  label?: string;
}

/** Logical grouping of nodes in the IR graph */
export interface IRGroup {
  /** Unique identifier for the group */
  id: string;
  /** Display label for the group */
  label: string;
  /** IDs of nodes belonging to this group */
  nodeIds: string[];
}

/** Layer representation for hierarchical diagram layouts */
export interface IRLayer {
  /** Unique identifier for the layer */
  id: string;
  /** Display label for the layer */
  label: string;
  /** IDs of nodes belonging to this layer */
  nodeIds: string[];
}

/** Node in a flow diagram representing a step in a process */
export interface FlowIRNode {
  /** Unique identifier for the flow node */
  id: string;
  /** Kind of step (e.g., visit, click, fill, expect) */
  kind: string;
  /** Display label describing the step */
  label: string;
}

/** Edge connecting steps in a flow diagram */
export interface FlowIREdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Optional transition label */
  label?: string;
}

/** Complete flow diagram intermediate representation */
export interface FlowIR {
  /** Unique identifier for the flow */
  id: string;
  /** Ordered list of nodes in the flow */
  nodes: FlowIRNode[];
  /** Edges connecting the flow nodes */
  edges: FlowIREdge[];
}

/** State definition in a finite state machine */
export interface FsmState {
  /** Actions executed when entering this state */
  actions: string[];
  /** Map of event names to target state names */
  transitions: Record<string, string>;
}

/** Complete finite state machine definition */
export interface Fsm {
  /** Unique identifier for the FSM */
  id: string;
  /** Human-readable name for the FSM */
  name: string;
  /** Name of the initial state */
  initial: string;
  /** Map of state names to state definitions */
  states: Record<string, FsmState>;
}

/** Widget component in a view definition */
export interface ViewWidget {
  /** Widget type (e.g., table, form, chart) */
  type: string;
  /** Token identifier for data binding */
  token: string;
  /** Optional static text content */
  text?: string;
  /** Optional display label */
  label?: string;
  /** Column definitions for table widgets */
  columns?: string[];
}

/** View definition representing a UI screen or page */
export interface View {
  /** Unique identifier for the view */
  id: string;
  /** Human-readable name for the view */
  name: string;
  /** Optional component reference */
  component?: string;
  /** Optional layout type */
  layout?: string;
  /** Whether the view requires authentication */
  requiresAuth: boolean;
  /** Widgets contained in this view */
  widgets: ViewWidget[];
}

/** Node in a site navigation graph */
export interface SiteNode {
  /** Unique identifier for the site node */
  id: string;
  /** Display label for the node */
  label: string;
  /** URL path for this node */
  path: string;
  /** Capabilities required to access this node */
  capabilities: string[];
}

/** Edge in a site navigation graph */
export interface SiteEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Navigation label */
  label: string;
  /** Edge type (e.g., link, redirect) */
  type: string;
}
