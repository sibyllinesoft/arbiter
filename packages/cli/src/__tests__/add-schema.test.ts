import { describe, expect, it } from "bun:test";
import { addSchema } from "@/services/add/subcommands/schema";

const manipulator = {
  addToSection: async (_c: string, section: string, key: string, value: any) =>
    JSON.stringify({ section, key, value }),
};

describe("addSchema helper", () => {
  it("adds schema entry to components.schemas", async () => {
    const res = await addSchema(manipulator, "", "openapi", {});
    const parsed = JSON.parse(res);
    expect(parsed.section).toBe("components.schemas");
    expect(parsed.key).toBe("openapi");
    expect(parsed.value).toEqual({});
  });
});
