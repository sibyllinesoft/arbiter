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

    it("should support Cargo.lock files", () => {
      expect(plugin.supports("/path/to/Cargo.lock")).toBe(true);
    });

    it("should support main.rs files", () => {
      expect(plugin.supports("/path/to/src/main.rs")).toBe(true);
    });

    it("should support lib.rs files", () => {
      expect(plugin.supports("/path/to/src/lib.rs")).toBe(true);
    });

    it("should support files in src directory", () => {
      expect(plugin.supports("/path/to/src/module.rs")).toBe(true);
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

      expect(evidence.length).toBeGreaterThanOrEqual(4); // package + 3 dependencies, maybe binary

      // Check package evidence
      const packageEvidence = evidence.find((e) => e.data.configType === "cargo-toml");
      expect(packageEvidence).toBeDefined();
      expect(packageEvidence?.data.package.name).toBe("my-rust-app");
      expect(packageEvidence?.data.hasBinaries).toBe(true);

      // Check binary evidence (might not be parsed due to [[bin]] array handling)
      const binaryEvidence = evidence.find((e) => e.data.configType === "binary-definition");
      expect(binaryEvidence).toBeDefined();
      expect(binaryEvidence?.data.binaryName).toBe("server");
    });

    it("should parse Rust source with main function", async () => {
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

      const evidence = await plugin.parse("/test/project/src/main.rs", mainRs);

      expect(evidence).toHaveLength(3); // main function + async main + HTTP framework detection

      const mainEvidence = evidence.find((e) => e.data.functionType === "main");
      expect(mainEvidence).toBeDefined();
      expect(mainEvidence?.data.isEntryPoint).toBe(true);

      const asyncMainEvidence = evidence.find((e) => e.data.functionType === "async-main");
      expect(asyncMainEvidence).toBeDefined();
      expect(asyncMainEvidence?.data.runtime).toBe("tokio");
    });
  });

  describe("infer", () => {
    it("should infer a web service from Cargo.toml with axum dependency", async () => {
      const cargoEvidence: Evidence = {
        id: "test-package",
        source: "rust",
        type: "config",
        filePath: "/test/Cargo.toml",
        data: {
          configType: "cargo-toml",
          package: { name: "web-service", version: "0.1.0" },
          hasBinaries: true,
          hasModule: false,
          dependencies: { axum: "0.7", tokio: "1.0" },
          devDependencies: {},
          buildDependencies: {},
        },
        confidence: 0.95,
        metadata: { timestamp: Date.now(), fileSize: 100 },
      };

      const binaryEvidence: Evidence = {
        id: "test-binary",
        source: "rust",
        type: "config",
        filePath: "/test/Cargo.toml",
        data: {
          configType: "binary-definition",
          binaryName: "server",
          binaryPath: "src/bin/server.rs",
        },
        confidence: 0.9,
        metadata: { timestamp: Date.now(), fileSize: 100 },
      };

      const context = buildInferenceContext([cargoEvidence, binaryEvidence]);

      const artifacts = await plugin.infer([cargoEvidence, binaryEvidence], context);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].artifact.type).toBe("service");
      expect(artifacts[0].artifact.name).toBe("server");
      expect(artifacts[0].artifact.metadata.framework).toBe("axum");
      expect(artifacts[0].artifact.metadata.language).toBe("rust");
    });

    it("should infer a CLI binary from Cargo.toml with clap dependency", async () => {
      const cargoEvidence: Evidence = {
        id: "test-package",
        source: "rust",
        type: "config",
        filePath: "/test/Cargo.toml",
        data: {
          configType: "cargo-toml",
          package: { name: "cli-tool", version: "0.1.0" },
          hasBinaries: true,
          hasModule: false,
          dependencies: { clap: "4.0" },
          devDependencies: {},
          buildDependencies: {},
        },
        confidence: 0.95,
        metadata: { timestamp: Date.now(), fileSize: 100 },
      };

      const mainEvidence: Evidence = {
        id: "test-main",
        source: "rust",
        type: "function",
        filePath: "/test/src/main.rs",
        data: {
          functionType: "main",
          isEntryPoint: true,
        },
        confidence: 0.95,
        metadata: { timestamp: Date.now(), fileSize: 100 },
      };

      const context = buildInferenceContext([cargoEvidence, mainEvidence]);

      const artifacts = await plugin.infer([cargoEvidence, mainEvidence], context);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].artifact.type).toBe("binary");
      expect(artifacts[0].artifact.name).toBe("cli-tool");
      expect(artifacts[0].artifact.tags).toContain("tool");
      expect(artifacts[0].artifact.metadata.language).toBe("rust");
    });

    it("should infer a module from Cargo.toml with lib section", async () => {
      const cargoEvidence: Evidence = {
        id: "test-package",
        source: "rust",
        type: "config",
        filePath: "/test/Cargo.toml",
        data: {
          configType: "cargo-toml",
          package: { name: "my-lib", version: "0.1.0", description: "A useful module" },
          hasBinaries: false,
          hasModule: true,
          dependencies: { serde: "1.0" },
          devDependencies: {},
          buildDependencies: {},
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
      expect(artifacts[0].artifact.metadata.packageManager).toBe("cargo");
    });

    it("should treat library crates with CLI dependencies as modules when no binaries are present", async () => {
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
          hasModule: false,
          dependencies: { clap: "4.0", serde: "1.0" },
          devDependencies: {},
          buildDependencies: {},
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
