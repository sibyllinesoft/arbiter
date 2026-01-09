import { type Context, Hono } from "hono";
import { MOCK_FLOW_DATA, MOCK_FSM_DATA, MOCK_SITE_DATA, MOCK_VIEW_DATA } from "./ir-mock-data";

type Dependencies = Record<string, unknown>;

/** IR endpoint configuration */
interface IrEndpointConfig {
  path: string;
  dataKey: string;
  data: unknown;
}

/** All IR endpoints with their configuration */
const IR_ENDPOINTS: IrEndpointConfig[] = [
  { path: "/ir/flow", dataKey: "flows", data: MOCK_FLOW_DATA },
  { path: "/ir/site", dataKey: "site", data: MOCK_SITE_DATA },
  { path: "/ir/fsm", dataKey: "fsm", data: MOCK_FSM_DATA },
  { path: "/ir/view", dataKey: "views", data: MOCK_VIEW_DATA },
];

/** Create a projectId missing error response */
const PROJECT_ID_ERROR = { error: "projectId parameter is required" } as const;

/** Create an IR route handler for the given configuration */
function createIrHandler(config: IrEndpointConfig) {
  return async (c: Context) => {
    const projectId = c.req.query("projectId");
    if (!projectId) return c.json(PROJECT_ID_ERROR, 400);

    return c.json({
      success: true,
      projectId,
      [config.dataKey]: config.data,
    });
  };
}

export function createIrRouter(_deps: Dependencies) {
  const router = new Hono();

  for (const endpoint of IR_ENDPOINTS) {
    router.get(endpoint.path, createIrHandler(endpoint));
  }

  return router;
}
