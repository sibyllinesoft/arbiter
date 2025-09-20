import type { Request } from 'bun';

export class StaticFileHandler {
  shouldServeStaticFile(_path: string): boolean {
    return false;
  }

  async serveFile(_path: string, headers: Record<string, string>): Promise<Response> {
    return new Response('Not Found', { status: 404, headers });
  }
}
