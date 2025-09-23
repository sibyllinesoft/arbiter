import { Hono } from 'hono';
import { gitScanner } from '../git-scanner';

type Dependencies = Record<string, unknown>;

export function createImportRouter(deps: Dependencies) {
  const router = new Hono();

  // Git import endpoints
  router.post('/scan-git', async c => {
    try {
      const { gitUrl } = await c.req.json();

      if (!gitUrl) {
        return c.json(
          {
            success: false,
            error: 'Git URL is required',
          },
          400
        );
      }

      const result = await gitScanner.scanGitUrl(gitUrl);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          400
        );
      }

      return c.json({
        success: true,
        tempPath: result.tempPath,
        files: result.files,
        projectStructure: result.projectStructure,
        gitUrl: result.gitUrl,
        projectName: result.projectName,
      });
    } catch (error) {
      console.error('Git scan error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to scan git repository',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  router.post('/scan-local', async c => {
    try {
      const { directoryPath } = await c.req.json();

      if (!directoryPath) {
        return c.json(
          {
            success: false,
            error: 'Directory path is required',
          },
          400
        );
      }

      const result = await gitScanner.scanLocalPath(directoryPath);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          400
        );
      }

      return c.json({
        success: true,
        path: result.tempPath,
        files: result.files,
        projectStructure: result.projectStructure,
      });
    } catch (error) {
      console.error('Local scan error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to scan local directory',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  router.delete('/cleanup/:tempId', async c => {
    try {
      const tempId = c.req.param('tempId');

      // Extract temp path from tempId (base64 encoded path)
      const tempPath = Buffer.from(tempId, 'base64').toString();

      await gitScanner.cleanup(tempPath);

      return c.json({
        success: true,
        message: 'Temporary directory cleaned up',
      });
    } catch (error) {
      console.error('Cleanup error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to cleanup temporary directory',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  return router;
}
