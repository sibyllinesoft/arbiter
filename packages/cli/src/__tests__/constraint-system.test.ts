import { describe, expect, it } from "bun:test";
import { ConstraintSystem } from "@/constraints/index";

const config = {
  apiUrl: "http://localhost:5050",
  projectDir: "/tmp",
  localMode: true,
} as any;

describe("ConstraintSystem", () => {
  it("creates system and executes with constraints", async () => {
    const system = new ConstraintSystem(config);
    const result = await system.executeWithConstraints("test-op", {}, async () => "ok", {
      meta: true,
    });
    expect(result).toBe("ok");
  });
});
