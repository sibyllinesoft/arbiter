import path from "node:path";
import type { FileParser } from "./base";

export const terraformParser: FileParser = {
  name: "terraform",
  priority: 4,
  matches: (filePath) => {
    const base = path.basename(filePath).toLowerCase();
    return base.endsWith(".tf") || base.endsWith(".tf.json");
  },
  parse: (content, context) => {
    const artifact = context.artifact;
    if (!artifact) return;

    const resourceCount = (content.match(/resource\s+"/g) || []).length;
    const moduleCount = (content.match(/module\s+"/g) || []).length;

    artifact.metadata = {
      ...artifact.metadata,
      terraform: {
        resourceCount,
        moduleCount,
      },
    };
  },
};
