import { describe, expect, it } from "bun:test";
import {
  addContractOperation,
  addContractWorkflow,
} from "@/services/add/subcommands/definitions/contracts";

const manipulator = {
  parse: async (content: string) => (content ? JSON.parse(content) : ({ contracts: {} } as any)),
  serialize: async (ast: any) => JSON.stringify(ast),
};

describe("contracts helpers", () => {
  it("adds contract operation", async () => {
    const baseContent = JSON.stringify({ contracts: { workflows: { users: {} } } });
    const res = await addContractOperation(manipulator, baseContent, "users", "getUser", {
      summary: "Retrieve user",
    });
    const parsed = JSON.parse(res);
    const op = parsed.contracts.workflows.users.operations.getUser;
    expect(op.summary).toBe("Retrieve user");
  });

  it("adds contract workflow", async () => {
    const res = await addContractWorkflow(manipulator, "", "signup", {
      steps: ["createUser", "sendEmail"],
    });
    const parsed = JSON.parse(res);
    expect(parsed.contracts.workflows.signup.version).toBe("1.0.0");
    expect(parsed.contracts.workflows.signup.operations).toEqual({});
  });
});
