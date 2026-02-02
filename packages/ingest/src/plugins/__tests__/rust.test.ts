/**
 * Tests for the Rust Plugin
 */

import { ArtifactClassifier } from "../../detection/classifier";
import { buildDirectoryContexts } from "../../detection/context-aggregator";
import type { Evidence, InferenceContext, ParseContext } from "../../types";
import { RustPlugin } from "../rust";

describe("RustPlugin", () => {
  let plugin: RustPlugin;

  beforeEach(() => {
    plugin = new RustPlugin();
  });

  const buildInferenceContext = (evidence: Evidence[], projectRoot = "/test"): InferenceContext => {
    const fileIndex = {
      root: projectRoot,
      files: new Map(),
      directories: new Map(),
      timestamp: Date.now(),
    };

    return {
      projectRoot,
      fileIndex,
      allEvidence: evidence,
      directoryContexts: buildDirectoryContexts(evidence, fileIndex, projectRoot),
      classifier: new ArtifactClassifier(),
      options: {
        minConfidence: 0.3,
        inferRelationships: true,
        maxDependencyDepth: 5,
        useHeuristics: true,
      },
      cache: new Map(),
      projectMetadata: {
        name: "test",
        root: projectRoot,
        languages: [],
        frameworks: [],
        fileCount: 0,
        totalSize: 0,
      },
    };
  };

  describe("supports", () => {
    it("should support Cargo.toml files", () => {
      expect(plugin.supports("/path/to/Cargo.toml")).toBe(true);
    });

    it("should not support Cargo.lock files (only Cargo.toml)", () => {
      expect(plugin.supports("/path/to/Cargo.lock")).toBe(false);
    });

    it("should not support main.rs files (only Cargo.toml)", () => {
      expect(plugin.supports("/path/to/src/main.rs")).toBe(false);
    });

    it("should not support lib.rs files (only Cargo.toml)", () => {
      expect(plugin.supports("/path/to/src/lib.rs")).toBe(false);
    });

    it("should not support other src files (only Cargo.toml)", () => {
      expect(plugin.supports("/path/to/src/module.rs")).toBe(false);
    });

    it("should not support non-Rust files", () => {
      expect(plugin.supports("/path/to/package.json")).toBe(false);
      expect(plugin.supports("/path/to/README.md")).toBe(false);
      expect(plugin.supports("/path/to/test.py")).toBe(false);
    });
  });

  describe("parse", () => {
    it("should parse a basic Cargo.toml", async () => {
      const cargoToml = `
[package]
name = "my-rust-app"
version = "0.1.0"
description = "A sample Rust application"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1.0", features = ["full"] }
clap = "4.0"

[[bin]]
name = "server"
path = "src/bin/server.rs"
`;

      const context: ParseContext = {
        projectRoot: "/test/project",
        fileIndex: {
          root: "/test/project",
          files: new Map(),
          directories: new Map(),
          timestamp: Date.now(),
        },
        options: {
          deepAnalysis: false,
          targetLanguages: [],
          maxFileSize: 1024 * 1024,
          includeBinaries: false,
          patterns: { include: ["**/*"], exclude: [] },
        },
        cache: new Map(),
      };

      const evidence = await plugin.parse("/test/project/Cargo.toml", cargoToml, context);

      // Simplified plugin produces a single evidence item
      expect(evidence.length).toBe(1);

      const packageEvidence = evidence[0];
      expect(packageEvidence.data.configType).toBe("cargo-toml");
      expect(packageEvidence.data.package.name).toBe("my-rust-app");
      expect(packageEvidence.data.hasBinaries).toBe(true);
      expect(packageEvidence.data.dependencies).toContain("axum");
      expect(packageEvidence.data.dependencies).toContain("tokio");
      expect(packageEvidence.data.dependencies).toContain("clap");
    });

    it("should not parse Rust source files (only Cargo.toml)", async () => {
      const mainRs = `
use axum::{Router, response::Html};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    let app = Router::new();
    let listener = TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
`;

      // Plugin only supports Cargo.toml, so parsing main.rs returns empty
      const evidence = await plugin.parse("/test/project/src/main.rs", mainRs);
      expect(evidence).toHaveLength(0);
    });
  });

  describe("infer", () => {
    it("should infer a package from Cargo.toml with axum dependency (agents classify later)", async () => {
      const cargoEvidence: Evidence = {
        id: "test-package",
        source: "rust",
        type: "config",
        filePath: "/test/Cargo.toml",
        data: {
          configType: "cargo-toml",
          package: { name: "web-service", version: "0.1.0" },
          hasBinaries: true,
          hasLibrary: false,
          dependencies: ["axum", "tokio"],
        },
        confidence: 0.95,
        metadata: { timestamp: Date.now(), fileSize: 100 },
      };

      const context = buildInferenceContext([cargoEvidence]);

      const artifacts = await plugin.infer([cargoEvidence], context);

      expect(artifacts).toHaveLength(1);
      // Importer outputs "package" - agents determine if it's a service based on framework metadata
      expect(artifacts[0].artifact.type).toBe("package");
      expect(artifacts[0].artifact.name).toBe("web-service");
      expect(artifacts[0].artifact.metadata.framework).toBe("axum");
      expect(artifacts[0].artifact.metadata.language).toBe("rust");
      expect(artifacts[0].artifact.metadata.hasBinaries).toBe(true);
    });

    it("should infer a package from Cargo.toml with clap dependency (agents classify later)", async () => {
      const cargoEvidence: Evidence = {
        id: "test-package",
        source: "rust",
        type: "config",
        filePath: "/test/Cargo.toml",
        data: {
          configType: "cargo-toml",
          package: { name: "cli-tool", version: "0.1.0" },
          hasBinaries: true,
          hasLibrary: false,
          dependencies: ["clap"],
        },
        confidence: 0.95,
        metadata: { timestamp: Date.now(), fileSize: 100 },
      };

      const context = buildInferenceContext([cargoEvidence]);

      const artifacts = await plugin.infer([cargoEvidence], context);

      expect(artifacts).toHaveLength(1);
      // Importer outputs "package" - agents determine if it's a tool based on framework/hasBinaries metadata
      expect(artifacts[0].artifact.type).toBe("package");
      expect(artifacts[0].artifact.name).toBe("cli-tool");
      expect(artifacts[0].artifact.metadata.framework).toBe("cli");
      expect(artifacts[0].artifact.metadata.language).toBe("rust");
      expect(artifacts[0].artifact.metadata.hasBinaries).toBe(true);
    });

    it("should infer a package from Cargo.toml with lib section", async () => {
      const cargoEvidence: Evidence = {
        id: "test-package",
        source: "rust",
        type: "config",
        filePath: "/test/Cargo.toml",
        data: {
          configType: "cargo-toml",
          package: { name: "my-lib", version: "0.1.0", description: "A useful module" },
          hasBinaries: false,
          hasLibrary: true,
          dependencies: ["serde"],
        },
        confidence: 0.95,
        metadata: { timestamp: Date.now(), fileSize: 100 },
      };

      const context = buildInferenceContext([cargoEvidence]);

      const artifacts = await plugin.infer([cargoEvidence], context);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].artifact.type).toBe("package");
      expect(artifacts[0].artifact.name).toBe("my-lib");
      expect(artifacts[0].artifact.description).toBe("A useful module");
      expect(artifacts[0].artifact.metadata.language).toBe("rust");
      expect(artifacts[0].artifact.metadata.hasLibrary).toBe(true);
    });

    it("should output package type for library crates with CLI dependencies", async () => {
      const cargoEvidence: Evidence = {
        id: "test-package",
        source: "rust",
        type: "config",
        filePath: "/workspace/smith/shared/Cargo.toml",
        data: {
          configType: "cargo-toml",
          package: {
            name: "smith-protocol",
            version: "0.1.0",
            description: "Protocol definitions",
          },
          hasBinaries: false,
          hasLibrary: false,
          dependencies: ["clap", "serde"],
        },
        confidence: 0.95,
        metadata: { timestamp: Date.now(), fileSize: 100 },
      };

      const context = buildInferenceContext([cargoEvidence], "/workspace/smith");

      const artifacts = await plugin.infer([cargoEvidence], context);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].artifact.type).toBe("package");
      expect(artifacts[0].artifact.name).toBe("smith-protocol");
    });
  });

  describe("name", () => {
    it('should return "rust"', () => {
      expect(plugin.name()).toBe("rust");
    });
  });
});
