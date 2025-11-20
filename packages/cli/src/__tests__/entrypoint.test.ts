import { describe, expect, it } from "bun:test";

import * as entrypoint from "../index";

describe("package entrypoint", () => {
  it("exports the program object without executing the CLI", () => {
    expect(typeof entrypoint).toBe("object");
    expect(entrypoint).toHaveProperty("program");
    expect(entrypoint.program?.name?.()).toBe("arbiter");
  });

  it("re-exports core helpers", () => {
    expect(entrypoint).toHaveProperty("ApiClient");
    expect(entrypoint).toHaveProperty("DEFAULT_CONFIG");
  });
});
