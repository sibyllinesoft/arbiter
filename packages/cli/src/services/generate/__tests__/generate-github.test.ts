import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

describe("handleGitHubSync", () => {
  let generateModule: any;
  let gitDetectionModule: any;

  beforeEach(async () => {
    // Only mock git-detection - don't mock github-sync as it pollutes other tests
    mock.module("@/utils/io/git-detection.js", () => ({
      getSmartRepositoryConfig: mock(() => null),
      validateRepositoryConfig: mock(() => ({ valid: true, errors: [], suggestions: [] })),
      detectGitHubRepository: mock(() => ({ detected: false })),
      parseGitHubUrl: mock(() => null),
      detectRepositoryConflicts: mock(() => null),
      displayConflictResolution: mock(() => {}),
      resolveRepositorySelection: mock(() => ({ useConfig: true, useDetected: false })),
      createRepositoryConfig: mock(() => ({})),
      findGitRoot: mock(() => null),
      isInGitRepo: mock(() => false),
    }));

    // Import with cache buster
    const timestamp = Date.now();
    generateModule = await import(`@/services/generate/io/index.js?t=${timestamp}`);
    gitDetectionModule = await import(`@/utils/io/git-detection.js?t=${timestamp}`);
  });

  afterEach(() => {
    mock.restore();
  });

  it("exits early when repository cannot be determined", async () => {
    // Override getSmartRepositoryConfig using spyOn
    spyOn(gitDetectionModule, "getSmartRepositoryConfig").mockReturnValue(null);

    const logError = spyOn(console, "error").mockImplementation(() => {});

    await generateModule.__generateTesting.handleGitHubSync(
      { githubDryRun: true } as any,
      { github: {} } as any,
    );

    expect(logError).toHaveBeenCalled();
    logError.mockRestore();
  });
});
