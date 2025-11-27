import { describe, expect, it } from "bun:test";
import { StaticFileHandler } from "../static";

describe("StaticFileHandler", () => {
  const handler = new StaticFileHandler();

  it("does not serve static files by default", () => {
    expect(handler.shouldServeStaticFile("/any")).toBe(false);
  });

  it("returns 404 response", async () => {
    const res = await handler.serveFile("/missing", {});
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not Found");
  });
});
