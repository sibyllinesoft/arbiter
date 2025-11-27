#!/usr/bin/env node
/**
 * Bun coverage -> lcov converter.
 * Bun's JSON coverage currently lacks line info; we approximate by mapping
 * byte-offset ranges to lines by reading the source file. This is coarse but
 * gives a usable lcov for reporting.
 */
import fs from "fs";
import path from "path";
import url from "url";

const excludeFragments = [
  "node_modules",
  "/dist/",
  "/tmp/",
  "packages/cli/src/services/generate/compose.ts",
  "packages/cli/src/services/generate/template-orchestrator.ts",
  "packages/cli/src/services/generate/hook-executor.ts",
  "packages/cli/src/language-plugins/",
  "packages/cli/src/templates/",
  "packages/cli/src/utils/generation-hooks.ts",
  "packages/cli/src/utils/github-sync.ts",
  "packages/cli/src/utils/git-detection.ts",
  "packages/cli/src/utils/sharded-storage.ts",
];

function isExcluded(p) {
  return excludeFragments.some((frag) => p.includes(frag));
}

const covDir = path.join(process.cwd(), "coverage", "tmp");
const jsonFiles = fs
  .readdirSync(covDir)
  .filter((f) => f.startsWith("coverage-") && f.endsWith(".json"))
  .map((f) => path.join(covDir, f));

if (jsonFiles.length === 0) {
  console.error("No Bun coverage JSON files found under coverage/tmp");
  process.exit(1);
}

const fileLineHits = new Map(); // file -> Map<line, count>

for (const file of jsonFiles) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const entry of data.result || []) {
    let p = entry.url || "";
    if (!p || p.startsWith("node:")) continue;
    if (p.startsWith("file://")) {
      p = url.fileURLToPath(p);
    }
    p = path.resolve(p);
    if (!p.includes("packages/cli/src")) continue;
    if (isExcluded(p)) continue;

    // ranges are byte offsets; map roughly to lines by counting newlines
    const source = fs.readFileSync(p, "utf8");
    const offsetsToLine = [];
    let line = 1;
    for (let i = 0; i < source.length; i++) {
      offsetsToLine[i] = line;
      if (source[i] === "\n") line++;
    }
    offsetsToLine[source.length] = line;

    const lineHits = fileLineHits.get(p) || new Map();
    for (const fn of entry.functions || []) {
      for (const r of fn.ranges || []) {
        const count = r.count || 0;
        const start = offsetsToLine[r.startOffset] ?? 1;
        const end = offsetsToLine[r.endOffset] ?? start;
        for (let ln = start; ln <= end; ln++) {
          lineHits.set(ln, Math.max(lineHits.get(ln) || 0, count));
        }
      }
    }
    fileLineHits.set(p, lineHits);
  }
}

const outPath = path.join(process.cwd(), "coverage", "lcov.info");
const out = fs.createWriteStream(outPath, { encoding: "utf8" });

for (const [file, hits] of fileLineHits.entries()) {
  out.write(`SF:${file}\n`);
  const lines = [...hits.entries()].sort((a, b) => a[0] - b[0]);
  for (const [ln, cnt] of lines) {
    out.write(`DA:${ln},${cnt}\n`);
  }
  out.write(`LF:${lines.length}\n`);
  out.write(`LH:${lines.filter(([, c]) => c > 0).length}\n`);
  out.write("end_of_record\n");
}

out.end(() => {
  console.log(`lcov written to ${outPath} (${fileLineHits.size} files)`);
});
