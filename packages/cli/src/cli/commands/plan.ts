/**
 * @packageDocumentation
 * Plan command module - Interactive feature planning assistant.
 *
 * Provides a command that outputs a structured prompt for AI agents
 * to guide feature planning conversations and produce high-level
 * project descriptions.
 */

import chalk from "chalk";
import { Command } from "commander";

/** System prompt for the AI feature planning assistant conversation */
const PLANNING_PROMPT = `You are helping a developer define WHAT to build, not HOW to build it.

Your goal: interview the user to produce a clear, high-level description of a proposed feature or project, similar in detail to a good README or short white paper. Capture intent, users, value, scope, and behavior — but avoid granular implementation details (no APIs, class names, database schemas, or libraries unless the user insists).

Process:

1. Ask one question at a time. Keep questions short and concrete.
2. Start from a rough idea, then iteratively deepen it. Aim to cover:
   - Problem / motivation: What pain or opportunity is this addressing?
   - Target users / stakeholders: Who is this for?
   - Desired outcomes / value: What changes when this succeeds?
   - Scope: What is in scope for this effort?
   - Out of scope: What is explicitly NOT being done (for now)?
   - Key behaviors / flows: What should a typical user be able to do, step by step?
   - Constraints: Any performance, compliance, integration, or timeline constraints?
   - Success criteria: How will we know this is "done" and working well?
3. Steer away from low-level design: if the user starts describing concrete technical solutions, briefly note them as "implementation ideas" but guide the conversation back to goals, behavior, and outcomes.
4. Stop asking questions once you have enough information for someone else on the team to understand what is being built and why, without needing to know the exact technical implementation.

At the end, synthesize everything into a concise markdown summary with the following sections:

# Feature Intent

## One-line summary
(Plain-language description of the feature.)

## Problem / Motivation
(Why this is being built; what pain or opportunity it addresses.)

## Target Users / Stakeholders
(Who this is for, and any important segments.)

## Desired Outcomes / Value
(The impact this feature should have if successful.)

## Scope
(Bulleted list of what is included.)

## Out of Scope
(Bulleted list of what is explicitly excluded for now.)

## Key User Flows / Behaviors
(Short, step-by-step descriptions of the main flows.)

## Constraints & Assumptions
(Performance, compliance, dependencies, timelines, or other constraints.)

## Success Criteria
(Clear, testable criteria for calling this "done".)

## Notable Implementation Ideas (Optional)
(Any technical ideas the user mentioned, without committing to them.)

Before returning the final summary, briefly confirm with the user:
"Is this an accurate description of what you want to build at a high level, leaving detailed architecture for later?"
Apply any corrections they request, then output only the final markdown summary.

Once you have a complete plan, re-run the cli using the design command.`;

/**
 * Create and register the plan command on the given program.
 * @param program - The Commander program instance
 */
export function createPlanCommand(program: Command): void {
  program
    .command("plan")
    .description("Interactive feature planning assistant for AI agents")
    .action(async () => {
      try {
        console.log(chalk.cyan("\n=== Feature Planning Assistant Prompt ===\n"));
        console.log(PLANNING_PROMPT);
        console.log(chalk.cyan("\n=========================================\n"));

        console.log(
          chalk.dim("\nProvide this prompt to your AI assistant to begin feature planning."),
        );
        console.log(chalk.dim("After planning, run: arbiter design\n"));

        process.exit(0);
      } catch (error) {
        console.error(
          chalk.red("Command failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(2);
      }
    });
}
