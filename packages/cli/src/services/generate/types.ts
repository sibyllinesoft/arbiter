export interface GenerateOptions {
  outputDir?: string;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  spec?: string;
  syncGithub?: boolean;
  githubDryRun?: boolean;
}
