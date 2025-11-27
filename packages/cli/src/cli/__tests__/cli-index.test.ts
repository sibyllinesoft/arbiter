import { afterEach, describe, expect, it, spyOn } from "bun:test";

describe("cli entry index", () => {
  afterEach(() => {
    spyOn.restoreAll?.();
  });

  const loadProgram = async () => {
    const mod = await import(`../index.js?ts=${Date.now()}`);
    return mod.default;
  };

  it("registers core commands on the program", async () => {
    const program = await loadProgram();
    const commandNames = program.commands.map((c: any) => c.name());

    expect(commandNames).toEqual(expect.arrayContaining(["add", "generate", "check", "remove"]));
    expect(program.name()).toBe("arbiter");
    expect(program.options.some((opt: any) => opt.long === "--api-url")).toBe(true);
  });

  it("exits with code 1 on unknown command", async () => {
    const program = await loadProgram();
    const exit = spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as any);
    const errLog = spyOn(console, "error").mockReturnValue();

    expect(() => program.parse(["node", "arbiter", "not-a-command"], { from: "user" })).toThrow(
      /exit:1/,
    );
    expect(errLog).toHaveBeenCalled();
    exit.mockRestore();
  });
});
