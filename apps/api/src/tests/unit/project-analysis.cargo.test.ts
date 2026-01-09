import { describe, expect, it } from "bun:test";
import type { ContentFetcher } from "../../git/content-fetcher";
import { analyzeProjectFiles } from "../../git/project-analysis";

describe("Cargo manifest analysis", () => {
  const createFetcher = (files: Record<string, string>): ContentFetcher => ({
    async fetchText(filePath: string) {
      return files[filePath] ?? null;
    },
  });

  it("classifies library crates without binaries as modules", async () => {
    const cargoPath = "shared/smith-protocol/Cargo.toml";
    const cargoContent = `
[package]
name = "smith-protocol"
version = "0.1.0"
description = "Shared protocol definitions"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
clap = "4.0"
`; // clap present but no binaries

    const result = await analyzeProjectFiles("project-1", "Smith", [cargoPath], {
      fetcher: createFetcher({ [cargoPath]: cargoContent }),
    });

    const artifact = result.artifacts.find((item) => item.filePath === cargoPath);
    expect(artifact).toBeDefined();
    expect(artifact?.type).toBe("package");
    expect(artifact?.name).toBe("smith-protocol");
    expect(artifact?.description).toBe("Shared protocol definitions");
    expect(artifact?.metadata?.cargo?.hasBinaries).toBe(false);
    expect(artifact?.metadata?.detectedType).toBe("package");
  });

  it("classifies Cargo web services using web frameworks", async () => {
    const cargoPath = "service/http/Cargo.toml";
    const cargoContent = `
[package]
name = "smith-http"
version = "0.3.0"
description = "HTTP gateway"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
`;

    const result = await analyzeProjectFiles("project-2", "Smith", [cargoPath], {
      fetcher: createFetcher({ [cargoPath]: cargoContent }),
    });

    const artifact = result.artifacts.find((item) => item.filePath === cargoPath);
    expect(artifact).toBeDefined();
    expect(artifact?.type).toBe("service");
    expect(artifact?.framework).toBe("axum");
    expect(artifact?.metadata?.detectedType).toBe("service");
    expect(artifact?.metadata?.cargo?.hasBinaries).toBe(false);
  });
});
