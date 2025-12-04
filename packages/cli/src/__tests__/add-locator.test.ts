import { describe, expect, it } from "bun:test";
import { addLocator } from "@/services/add/subcommands/locator";

const manipulator = {
  addToSection: async (_c: string, _section: string, key: string, value: any) =>
    JSON.stringify({ key, value }),
};

describe("addLocator helper", () => {
  it("adds locator with selector", async () => {
    const res = await addLocator(manipulator, "", "button", { selector: "#submit" });
    const parsed = JSON.parse(res);
    expect(parsed.key).toBe("button");
    expect(parsed.value).toBe("#submit");
  });
});
