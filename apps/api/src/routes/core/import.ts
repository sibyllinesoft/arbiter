import { Hono } from "hono";
import type { Context } from "hono";
import { gitScanner } from "../../git/git-scanner";

type Dependencies = Record<string, unknown>;
type RouteHandler = (c: Context) => Promise<Response>;

function errorResponse(c: Context, message: string, details?: string, status: 400 | 500 = 500) {
  return c.json(
    {
      success: false,
      error: message,
      ...(details && { message: details }),
    },
    status,
  );
}

function successResponse(c: Context, data: Record<string, unknown>) {
  return c.json({ success: true, ...data });
}

/** Wrap a route handler with standardized error handling */
function withErrorHandling(label: string, handler: RouteHandler): RouteHandler {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      console.error(`${label} error:`, error);
      const details = error instanceof Error ? error.message : "Unknown error";
      return errorResponse(c, `Failed to ${label.toLowerCase()}`, details);
    }
  };
}

/** Handle git URL scanning */
async function handleScanGit(c: Context): Promise<Response> {
  const { gitUrl } = await c.req.json();
  if (!gitUrl) return errorResponse(c, "Git URL is required", undefined, 400);

  const result = await gitScanner.scanGitUrl(gitUrl, process.env.GITHUB_TOKEN);
  if (!result.success) return errorResponse(c, result.error ?? "Scan failed", undefined, 400);

  return successResponse(c, {
    tempPath: result.tempPath,
    files: result.files,
    projectStructure: result.projectStructure,
    gitUrl: result.gitUrl,
    projectName: result.projectName,
  });
}

/** Handle local directory scanning */
async function handleScanLocal(c: Context): Promise<Response> {
  const { directoryPath } = await c.req.json();
  if (!directoryPath) return errorResponse(c, "Directory path is required", undefined, 400);

  const result = await gitScanner.scanLocalPath(directoryPath);
  if (!result.success) return errorResponse(c, result.error ?? "Scan failed", undefined, 400);

  return successResponse(c, {
    path: result.tempPath,
    files: result.files,
    projectStructure: result.projectStructure,
  });
}

/** Handle temporary directory cleanup */
async function handleCleanup(c: Context): Promise<Response> {
  const tempId = c.req.param("tempId");
  const tempPath = Buffer.from(tempId, "base64").toString();
  await gitScanner.cleanup(tempPath);
  return successResponse(c, { message: "Temporary directory cleaned up" });
}

export function createImportRouter(_deps: Dependencies) {
  const router = new Hono();

  router.post("/scan-git", withErrorHandling("scan git repository", handleScanGit));
  router.post("/scan-local", withErrorHandling("scan local directory", handleScanLocal));
  router.delete(
    "/cleanup/:tempId",
    withErrorHandling("cleanup temporary directory", handleCleanup),
  );

  return router;
}
