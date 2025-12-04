import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { addService } from "@/services/add/subcommands/service.js";
import * as templateEngine from "@/services/add/template-engine.js";
import * as platform from "@/utils/platform-detection.js";

const createManipulator = () => ({
  addService: mock(async (_c: string, name: string, cfg: any) => `added:${name}:${cfg.type}`),
  addRoute: mock(async (_c: string, route: any) => `route:${route.id}`),
  addToSection: mock(
    async (_c: string, section: string, key: string, value: any) => `${section}:${key}:${value}`,
  ),
});

afterEach(() => {
  mock.restore();
});

describe("addService", () => {
  it("creates internal service with default ts route/locator", async () => {
    const manipulator = createManipulator();
    const result = await addService(manipulator as any, "content", "demo", { port: 3000 });

    expect(result).toBe('locators:page:demo:[data-testid="demo-page"]');
    expect(manipulator.addService).toHaveBeenCalledTimes(1);
    expect(manipulator.addRoute).toHaveBeenCalledTimes(1);
    expect(manipulator.addToSection).toHaveBeenCalledTimes(1);
    expect(manipulator.addRoute.mock.calls[0][1].path).toBe("/");
  });

  it("creates prebuilt service when image provided without routes", async () => {
    const manipulator = createManipulator();
    const result = await addService(manipulator as any, "c", "db", {
      image: "postgres:15",
      port: 5432,
    });

    expect(result).toBe("added:db:external");
    expect(manipulator.addRoute).not.toHaveBeenCalled();
    expect(manipulator.addToSection).not.toHaveBeenCalled();
    expect(manipulator.addService.mock.calls[0][2]).toMatchObject({
      image: "postgres:15",
      workload: "statefulset",
      language: "container",
      type: "external",
    });
  });

  it("uses platform defaults when serviceType provided", async () => {
    const manipulator = createManipulator();
    const defaults = { artifactType: "external", language: "python", workload: "serverless" };
    spyOn(platform, "getPlatformServiceDefaults").mockReturnValue(defaults as any);

    const result = await addService(manipulator as any, "c", "api", {
      serviceType: "cloudflare" as any,
    });

    expect(result).toBe('locators:page:api:[data-testid="api-page"]');
    expect(platform.getPlatformServiceDefaults).toHaveBeenCalledWith("cloudflare");
    expect(manipulator.addService.mock.calls[0][2]).toMatchObject({
      type: "external",
      language: "python",
      workload: "serverless",
    });
  });

  it("invokes template path and adds ui components", async () => {
    const manipulator = createManipulator();
    const validate = spyOn(templateEngine, "validateTemplateExists").mockResolvedValue();
    const exec = spyOn(templateEngine, "executeTemplate").mockResolvedValue();

    const result = await addService(manipulator as any, "c", "site", {
      template: "starter",
      language: "typescript",
    });

    expect(validate).toHaveBeenCalledWith("starter");
    expect(exec).toHaveBeenCalled();
    expect(manipulator.addService).toHaveBeenCalledWith(
      "c",
      "site",
      expect.objectContaining({ template: "starter", language: "typescript" }),
    );
    expect(result).toBe('locators:page:site:[data-testid="site-page"]');
    expect(manipulator.addRoute).toHaveBeenCalledTimes(1);
  });
});
