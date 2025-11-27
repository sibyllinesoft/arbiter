import { describe, expect, it, spyOn } from "bun:test";
import fs from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

import * as constraints from "../../../constraints/index.js";
import { __docsTesting, docsCommand, docsGenerateCommand } from "../index.js";

const baseConfig: any = { projectDir: process.cwd(), format: "table" };

describe("docs command helpers", () => {
  it("docsGenerateCommand writes markdown and json outputs", async () => {
    const tmp = await mkdtemp(path.join(import.meta.dir, "docs-gen-"));
    const safeSpy = spyOn(constraints, "safeFileOperation").mockImplementation(
      async (_op, p, writer) => writer(p),
    );
    const code = await docsGenerateCommand({ output: tmp, formats: "markdown,json" }, baseConfig);
    expect(code).toBe(0);
    const md = await fs.readFile(path.join(tmp, "cli-reference.md"), "utf-8");
    expect(md).toContain("Arbiter CLI Reference");
    safeSpy.mockRestore();
    await rm(tmp, { recursive: true, force: true });
  });

  it("docsCommand help path returns 0", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const code = await docsCommand("help", {}, baseConfig);
    expect(code).toBe(0);
    logSpy.mockRestore();
  });

  it("generateMarkdownDocs and generateHtmlDocs produce content", () => {
    const doc = {
      name: "Thing",
      description: "desc",
      fields: [{ name: "id", type: "string", required: true, description: "", constraints: [] }],
      examples: [],
      constraints: [],
      imports: [],
    };
    const md = __docsTesting.generateMarkdownDocs(doc as any);
    const html = __docsTesting.generateHtmlDocs(doc as any);
    expect(md).toContain("Thing");
    expect(html).toContain("<h1");
  });

  it("generateApiDocs handles markdown format", () => {
    const api = { paths: { "/foo": { get: {} } }, info: { title: "Demo" } };
    const md = __docsTesting.generateApiDocs(api, "markdown");
    expect(md).toContain("API Documentation");
  });
});
