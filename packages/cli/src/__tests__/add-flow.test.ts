import { describe, expect, it } from "bun:test";
import { addFlow } from "../services/add/subcommands/flow";

const manipulator = {
  addFlow: async (_c: string, cfg: any) => JSON.stringify(cfg),
};

describe("addFlow helper", () => {
  it("creates flow config with steps", async () => {
    const stepsJson = JSON.stringify([
      { visit: "/" },
      { click: "btn:checkout" },
      { expect: { locator: "page:receipt", state: "visible" } },
    ]);
    const res = await addFlow(manipulator, "", "checkout", {
      steps: stepsJson,
    });
    const parsed = JSON.parse(res);
    expect(parsed.id).toBe("checkout");
    expect(parsed.steps).toEqual([
      { visit: "/" },
      { click: "btn:checkout" },
      { expect: { locator: "page:receipt", state: "visible" } },
    ]);
  });
});
