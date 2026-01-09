import { describe, expect, it, spyOn } from "bun:test";
import { SpecificationRepository } from "@/repositories/specification-repository.js";

class StubApiClient {
  constructor(private readonly responder: (endpoint: string, init?: RequestInit) => any) {}

  validatePayloadSize = spyOn({ fn: () => {} }, "fn").mockImplementation(() => {});

  request(endpoint: string, init?: RequestInit) {
    return this.responder(endpoint, init);
  }
}

const okResponse = (data: any) =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as any;

const errorResponse = (status: number, body: string) =>
  ({
    ok: false,
    status,
    json: async () => ({ error: body }),
    text: async () => body,
  }) as any;

describe("SpecificationRepository", () => {
  it("stores specification successfully", async () => {
    const client = new StubApiClient(() => okResponse({ id: "abc", shard: "services" })) as any;
    const repo = new SpecificationRepository(client);

    const result = await repo.storeSpecification({
      content: "package spec",
      type: "assembly",
      path: "/tmp/assembly.cue",
      shard: "assembly",
    });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe("abc");
    expect(client.validatePayloadSize.mock.calls.length).toBe(2);
  });

  it("handles store specification errors", async () => {
    const client = new StubApiClient(() => errorResponse(500, "boom")) as any;
    const repo = new SpecificationRepository(client);

    const result = await repo.storeSpecification({
      content: "package spec",
      type: "assembly",
      path: "/tmp/assembly.cue",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to store specification");
  });

  it("returns 404 as not found for getSpecification", async () => {
    const client = new StubApiClient(() => errorResponse(404, "missing")) as any;
    const repo = new SpecificationRepository(client);

    const result = await repo.getSpecification("assembly", "/tmp/assembly.cue");

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
    expect(result.exitCode).toBe(1);
  });

  it("retrieves IR successfully", async () => {
    const client = new StubApiClient(() => okResponse({ success: true, ir: "data" })) as any;
    const repo = new SpecificationRepository(client);

    const result = await repo.getIR("package spec");

    expect(result.success).toBe(true);
    expect(result.data?.ir).toBe("data");
    expect(client.validatePayloadSize.mock.calls.length).toBe(2);
  });

  it("surfaces IR API errors", async () => {
    const client = new StubApiClient(() => errorResponse(500, "bad")) as any;
    const repo = new SpecificationRepository(client);

    const result = await repo.getIR("package spec");

    expect(result.success).toBe(false);
    expect(result.error).toContain("API error");
  });
});
