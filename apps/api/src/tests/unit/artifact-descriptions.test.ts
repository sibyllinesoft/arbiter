import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { generateId } from "../../io/utils";
import { SpecWorkbenchDB } from "../../util/db";
import type { ServerConfig } from "../../util/types";

describe("Artifact description persistence", () => {
  let db: SpecWorkbenchDB;
  let projectId: string;

  beforeEach(async () => {
    const config: ServerConfig = {
      port: 0,
      host: "localhost",
      database_path: ":memory:",
      spec_workdir: `/tmp/artifact-description-test-${Date.now()}`,
      jq_binary_path: "jq",
      auth_required: false,
      external_tool_timeout_ms: 5000,
      websocket: {
        max_connections: 10,
        ping_interval_ms: 30000,
      },
    };

    db = await SpecWorkbenchDB.create(config);
    projectId = generateId();
    await db.createProject(projectId, "Description Project");
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  it("stores and retrieves artifact descriptions", async () => {
    const artifactId = generateId();
    const description = "Example module imported from package.json";

    await db.createArtifact(
      artifactId,
      projectId,
      "example-module",
      description,
      "module",
      "typescript",
      null,
      {
        package: {
          name: "example-module",
          description,
        },
      },
      "packages/example-module/package.json",
    );

    const artifacts = await db.getArtifacts(projectId);
    const stored = artifacts.find((artifact) => artifact.id === artifactId);

    expect(stored).toBeDefined();
    expect(stored?.description).toBe(description);
  });

  it("backfills missing descriptions from stored metadata", async () => {
    const artifactId = generateId();
    const legacyDescription = "Legacy module description sourced from metadata";

    await db.createArtifact(
      artifactId,
      projectId,
      "legacy-module",
      null,
      "module",
      "typescript",
      null,
      {
        package: {
          name: "legacy-module",
          description: legacyDescription,
        },
      },
      "packages/legacy-module/package.json",
    );

    const internalDb = db as unknown as {
      backfillArtifactDescriptions: () => Promise<void>;
    };
    await internalDb.backfillArtifactDescriptions();

    const artifacts = await db.getArtifacts(projectId);
    const stored = artifacts.find((artifact) => artifact.id === artifactId);

    expect(stored?.description).toBe(legacyDescription);
  });
});
