/**
 * Example: Spec validation handler
 * Automatically validates CUE specifications when changes are detected
 */

import type { HandlerModule, WebhookHandler } from "../types.js";

const handleSpecValidation: WebhookHandler = async (payload, context) => {
  const { logger, services, projectId } = context;
  const { parsed } = payload;

  logger.info("Processing spec validation handler", {
    event: parsed.eventType,
    repository: parsed.repository.fullName,
    commitCount: parsed.commits?.length || 0,
  });

  try {
    // Check if any CUE files were modified
    const specFiles =
      parsed.commits?.flatMap((commit) => [
        ...commit.added.filter((file) => file.endsWith(".cue")),
        ...commit.modified.filter((file) => file.endsWith(".cue")),
      ]) || [];

    if (specFiles.length === 0) {
      logger.debug("No CUE files changed, skipping validation");
      return {
        success: true,
        message: "No CUE files changed",
        actions: [],
      };
    }

    logger.info("CUE files detected for validation", {
      files: specFiles,
      count: specFiles.length,
    });

    const actions: string[] = [];

    // Trigger spec validation event
    await services.events.broadcastToProject(projectId, {
      project_id: projectId,
      event_type: "validation_started",
      data: {
        trigger: "spec_validation_handler",
        repository: parsed.repository.fullName,
        ref: payload.ref,
        specFiles,
        commits:
          parsed.commits?.map((c) => ({
            sha: c.sha,
            message: c.message,
            author: c.author,
          })) || [],
      },
    });

    actions.push(`Triggered validation for ${specFiles.length} CUE files`);

    // For each spec file, log what changed
    for (const file of specFiles) {
      const commit = parsed.commits?.find(
        (c) => c.added.includes(file) || c.modified.includes(file),
      );

      if (commit) {
        const action = commit.added.includes(file) ? "added" : "modified";
        logger.info(`Spec file ${action}`, {
          file,
          commit: commit.sha,
          message: commit.message,
        });

        actions.push(`Detected ${action} spec file: ${file}`);
      }
    }

    // Check for breaking changes based on commit messages
    const breakingChanges =
      parsed.commits?.filter(
        (commit) =>
          commit.message.toLowerCase().includes("breaking") ||
          commit.message.toLowerCase().includes("breaking change") ||
          commit.message.includes("BREAKING CHANGE:"),
      ) || [];

    if (breakingChanges.length > 0) {
      logger.warn("Breaking changes detected in spec files", {
        commits: breakingChanges.map((c) => ({ sha: c.sha, message: c.message })),
      });

      // Broadcast breaking change warning
      await services.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: "validation_started",
        data: {
          trigger: "breaking_change_detection",
          repository: parsed.repository.fullName,
          breakingChanges: breakingChanges.map((c) => ({
            sha: c.sha,
            message: c.message,
            author: c.author,
          })),
          warning: "Breaking changes detected in specification files",
        },
      });

      actions.push(`⚠️ Detected ${breakingChanges.length} commits with breaking changes`);
    }

    // Check for assembly files specifically
    const assemblyFiles = specFiles.filter(
      (file) => file.includes("assembly") || file.includes(".assembly.cue"),
    );

    if (assemblyFiles.length > 0) {
      logger.info("Assembly files detected, triggering comprehensive validation", {
        assemblyFiles,
      });

      await services.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: "validation_started",
        data: {
          trigger: "assembly_validation",
          repository: parsed.repository.fullName,
          assemblyFiles,
          validationType: "comprehensive",
        },
      });

      actions.push(
        `🏗️ Triggered comprehensive validation for ${assemblyFiles.length} assembly files`,
      );
    }

    // Estimate validation complexity
    const totalLines =
      parsed.commits?.reduce((sum, commit) => {
        return sum + (commit.added.length + commit.modified.length);
      }, 0) || 0;

    let complexity = "low";
    if (totalLines > 50 || breakingChanges.length > 0) {
      complexity = "high";
    } else if (totalLines > 20 || assemblyFiles.length > 0) {
      complexity = "medium";
    }

    logger.info("Validation complexity estimated", {
      complexity,
      totalLines,
      specFiles: specFiles.length,
      assemblyFiles: assemblyFiles.length,
      breakingChanges: breakingChanges.length,
    });

    return {
      success: true,
      message: `Validation triggered for ${specFiles.length} CUE files`,
      actions,
      data: {
        specFilesChanged: specFiles.length,
        assemblyFilesChanged: assemblyFiles.length,
        breakingChangesDetected: breakingChanges.length,
        validationComplexity: complexity,
        repository: parsed.repository.fullName,
        ref: payload.ref,
      },
    };
  } catch (error) {
    logger.error("Spec validation handler failed", error as Error);

    return {
      success: false,
      message: "Spec validation handler execution failed",
      errors: [
        {
          code: "VALIDATION_HANDLER_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      ],
    };
  }
};

const handlerModule: HandlerModule = {
  handler: handleSpecValidation,
  config: {
    enabled: true,
    timeout: 20000,
    retries: 1,
    environment: {
      VALIDATION_MODE: "strict",
    },
    secrets: {},
  },
  metadata: {
    name: "Spec Validation Handler",
    description: "Automatically validates CUE specifications when changes are detected in commits",
    version: "1.0.0",
    author: "Arbiter Team",
    supportedEvents: ["push", "Push Hook"],
    requiredPermissions: ["events:publish", "validation:trigger"],
  },
};

export default handlerModule;
