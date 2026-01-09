import * as path from "path";
import * as fs from "fs-extra";
import type {
  ConfidenceScore,
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
  Provenance,
} from "../types";

export interface TerraformData {
  name?: string;
  type: string;
  provider?: string;
  filePath: string;
  [key: string]: unknown;
}

export class TerraformPlugin implements ImporterPlugin {
  name(): string {
    return "terraform";
  }

  supports(filePath: string): boolean {
    const basename = path.basename(filePath).toLowerCase();
    const relative = path.relative(process.cwd(), filePath).toLowerCase();
    return (
      basename.endsWith(".tf") ||
      basename.endsWith(".tf.json") ||
      basename === ".terraform.lock.hcl" ||
      relative.includes("terraform")
    );
  }

  /**
   * Determine which parser to use based on filename
   */
  private selectParser(
    basename: string,
  ): ((content: string, filePath: string, projectRoot: string) => Evidence[]) | null {
    if (basename === ".terraform.lock.hcl") {
      return this.parseTerraformLock.bind(this);
    }
    if (basename.endsWith(".tf")) {
      return this.parseTerraformFile.bind(this);
    }
    return null;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) {
      throw new Error("File content required for Terraform parsing");
    }

    const basename = path.basename(filePath).toLowerCase();
    const parser = this.selectParser(basename);
    if (!parser) {
      return [];
    }

    try {
      return parser(fileContent, filePath, context?.projectRoot || "/");
    } catch (error) {
      console.warn(`Failed to parse Terraform file ${filePath}:`, error);
      return [];
    }
  }

  private parseTerraformLock(content: string, filePath: string, projectRoot: string): Evidence[] {
    const evidence: Evidence[] = [];

    // Simple parsing for lockfile - look for provider blocks
    const providerMatches = content.match(
      /provider\s+"([^"]+)"\s+\(\n\s+version\s+=\s+"([^"]+)"\n\s+\)/g,
    );
    if (providerMatches) {
      providerMatches.forEach((match, index) => {
        const providerName = match.match(/provider\s+"([^"]+)"/)?.[1];
        const data: TerraformData = {
          name: `provider`,
          type: "provider",
          provider: providerName,
          filePath,
        };

        const evidenceId = `${path.relative(projectRoot, filePath)}`;
        evidence.push({
          id: evidenceId,
          source: this.name(),
          type: "infrastructure",
          filePath,
          data,
          metadata: {
            timestamp: Date.now(),
            fileSize: content.length,
          },
        });
      });
    }

    return evidence;
  }

  private parseTerraformFile(content: string, filePath: string, projectRoot: string): Evidence[] {
    const evidence: Evidence[] = [];

    // Parse for resource, data, provider blocks
    const resourceMatches = content.match(/resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g);
    if (resourceMatches) {
      resourceMatches.forEach((match, index) => {
        const provider = match.match(/resource\s+"([^"]+)"/)?.[1];
        const name = match.match(/resource\s+"[^"]+"\s+"([^"]+)"/)?.[1];

        const data: TerraformData = {
          name,
          type: "resource",
          provider,
          filePath,
        };

        const evidenceId = `${path.relative(projectRoot, filePath)}`;
        evidence.push({
          id: evidenceId,
          source: this.name(),
          type: "infrastructure",
          filePath,
          data,
          metadata: {
            timestamp: Date.now(),
            fileSize: content.length,
          },
        });
      });
    }

    // Parse provider blocks
    const providerMatches = content.match(/provider\s+"([^"]+)"\s*\{/g);
    if (providerMatches) {
      providerMatches.forEach((match, index) => {
        const providerName = match.match(/provider\s+"([^"]+)"/)?.[1];

        const data: TerraformData = {
          name: `${providerName}`,
          type: "provider",
          provider: providerName,
          filePath,
        };

        const evidenceId = `${path.relative(projectRoot, filePath)}`;
        evidence.push({
          id: evidenceId,
          source: this.name(),
          type: "infrastructure",
          filePath,
          data,
          metadata: {
            timestamp: Date.now(),
            fileSize: content.length,
          },
        });
      });
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];

    // Filter Terraform evidence
    const tfEvidence = evidence.filter(
      (e) => e.source === this.name() && e.type === "infrastructure",
    );

    if (tfEvidence.length === 0) return artifacts;

    // Find directories with .terraform.lock.hcl as root
    const lockFilePaths = tfEvidence
      .filter((e) => e.filePath.endsWith(".terraform.lock.hcl"))
      .map((e) => path.dirname(e.filePath));
    if (lockFilePaths.length === 0) return artifacts;

    for (const lockDir of lockFilePaths) {
      // Collect all tf files in this directory tree
      const tfFilesInDir = tfEvidence
        .filter((e) => e.filePath.startsWith(lockDir) && e.filePath.endsWith(".tf"))
        .map((e) => e.filePath);

      if (tfFilesInDir.length === 0) continue;

      // Extract resources from evidence in this group
      const groupEvidence = tfEvidence.filter((e) => e.filePath.startsWith(lockDir));
      const resources = groupEvidence
        .filter((e) => e.data.type === "resource")
        .map((e) => {
          const data = e.data as TerraformData;
          return { kind: data.type || "resource", name: data.name, apiVersion: data.provider };
        });

      const artifact = {
        id: `${path.basename(lockDir)}`,
        type: "infrastructure" as const,
        name: `Terraform Infrastructure (${path.basename(lockDir)})`,
        description: `Terraform configurations in ${lockDir}`,
        tags: ["terraform", "infrastructure"],
        metadata: {
          root: lockDir,
          files: [...tfFilesInDir, path.join(lockDir, ".terraform.lock.hcl")],
          kind: "terraform" as const,
          resources,
        },
      };

      artifacts.push({
        artifact,
        provenance: {
          evidence: groupEvidence.map((e) => e.id),
          plugins: ["terraform"],
          rules: ["tf-grouping", "lockfile-detection"],
          timestamp: Date.now(),
          pipelineVersion: "1.0.0",
        },
        relationships: [],
      });
    }

    return artifacts;
  }
}

export const terraformPlugin = new TerraformPlugin();
