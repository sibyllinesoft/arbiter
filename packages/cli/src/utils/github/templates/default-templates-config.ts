/**
 * Default GitHub Templates Configuration
 *
 * Default template configuration for backward compatibility with GitHub issue templates.
 * Extracted from unified-github-template-manager.ts for modularity.
 */

import type { GitHubTemplatesConfig } from "@/types.js";

/**
 * Default template configuration for backward compatibility
 */
export const DEFAULT_TEMPLATES_CONFIG: GitHubTemplatesConfig = {
  base: {
    name: "arbiter-default",
    description: "Default Arbiter template set",
    sections: {
      description: "## 📋 Description\n\n{{description}}\n\n",
      details: [
        { name: "priority", label: "Priority", required: true, type: "select" },
        { name: "status", label: "Status", required: true, type: "select" },
        { name: "assignee", label: "Assignee", type: "text" },
        { name: "estimatedHours", label: "Estimated Hours", type: "number" },
      ],
      acceptanceCriteria:
        "## ✅ Acceptance Criteria\n\n{{#each acceptanceCriteria}}\n- [ ] {{this}}\n{{/each}}\n\n",
      dependencies: "## 🔗 Dependencies\n\n{{#each dependencies}}\n- [ ] {{this}}\n{{/each}}\n\n",
    },
    labels: ["arbiter-managed"],
    validation: {
      fields: [
        {
          field: "name",
          required: true,
          minLength: 5,
          maxLength: 80,
          errorMessage: "Name must be 5-80 characters",
        },
        {
          field: "description",
          required: true,
          minLength: 10,
          errorMessage: "Description must be at least 10 characters",
        },
      ],
    },
  },
  group: {
    inherits: "arbiter-default",
    name: "Group",
    title: "[GROUP] {{priority}}: {{name}}",
    labels: ["group", "priority:{{priority}}", "status:{{status}}"],
    sections: {
      description:
        "## 📋 Group Description\n\n**Summary:** {{description}}\n\n**Success Criteria:** {{successCriteria}}\n\n",
      additional: {
        scope:
          "## 🎯 Scope\n\n**In Scope:**\n{{#each inScope}}\n- {{this}}\n{{/each}}\n\n**Out of Scope:**\n{{#each outOfScope}}\n- {{this}}\n{{/each}}\n\n",
        tasks:
          "## ✅ Tasks Overview\n\n**Total Tasks:** {{tasks.length}}\n\n{{#each tasks}}\n- [ ] {{this.name}} ({{this.status}})\n{{/each}}\n\n",
      },
    },
    validation: {
      fields: [
        {
          field: "priority",
          required: true,
          enum: ["critical", "high", "medium", "low"],
          errorMessage: "Priority must be one of: critical, high, medium, low",
        },
        {
          field: "owner",
          required: true,
          errorMessage: "Group must have an assigned owner",
        },
      ],
    },
  },
  issue: {
    inherits: "arbiter-default",
    name: "Issue",
    title: "[ISSUE] {{type}}: {{name}}",
    labels: ["type:{{type}}", "priority:{{priority}}", "status:{{status}}", "group:{{groupId}}"],
    sections: {
      description: "## 📋 Task Description\n\n{{description}}\n\n**Context:** {{context}}\n\n",
      additional: {
        implementation:
          "## 🔧 Implementation\n\n**Notes:** {{implementationNotes}}\n\n**Technical Notes:** {{technicalNotes}}\n\n",
        testing:
          "## 🧪 Testing\n\n**Test Scenarios:**\n{{#each testScenarios}}\n- [ ] {{this}}\n{{/each}}\n\n",
        subtasks:
          "## 📝 Subtasks\n\n{{#each subtasks}}\n- [ ] **{{this.name}}** - {{this.description}}\n{{/each}}\n\n",
      },
    },
    validation: {
      fields: [
        {
          field: "type",
          required: true,
          enum: ["feature", "bug", "improvement", "refactor", "docs", "test"],
          errorMessage: "Type must be one of: feature, bug, improvement, refactor, docs, test",
        },
        {
          field: "groupId",
          required: false,
          errorMessage: "Group ID must be provided if task belongs to an group",
        },
      ],
    },
  },
  bugReport: {
    name: "Bug Report",
    title: "[BUG] {{severity}}: {{summary}}",
    labels: ["type:bug", "severity:{{severity}}", "priority:{{priority}}"],
    sections: {
      description:
        "## 🐛 Bug Report\n\n**Summary:** {{summary}}\n\n**Impact:** {{impact.businessImpact}}\n\n",
      additional: {
        reproduction:
          "## 🔄 Reproduction\n\n**Steps to Reproduce:**\n{{#each stepsToReproduce}}\n{{@index}}. {{this}}\n{{/each}}\n\n",
        behavior:
          "## 🎯 Expected vs Actual Behavior\n\n**Expected:** {{expectedBehavior}}\n\n**Actual:** {{actualBehavior}}\n\n",
        environment:
          "## 🌍 Environment\n\n- **OS:** {{environment.os}}\n- **Browser:** {{environment.browser}}\n- **Version:** {{environment.version}}\n{{#if environment.additional}}\n- **Additional:** {{environment.additional}}\n{{/if}}\n\n",
        workaround: "{{#if workaround}}## 🔧 Workaround\n\n{{workaround}}\n\n{{/if}}",
      },
    },
    validation: {
      fields: [
        {
          field: "severity",
          required: true,
          enum: ["critical", "high", "medium", "low"],
          errorMessage: "Severity must be one of: critical, high, medium, low",
        },
        {
          field: "stepsToReproduce",
          required: true,
          minLength: 1,
          errorMessage: "At least one reproduction step is required",
        },
      ],
    },
  },
  featureRequest: {
    name: "Feature Request",
    title: "[FEATURE] {{priority}}: {{summary}}",
    labels: ["type:feature", "priority:{{priority}}"],
    sections: {
      description:
        "## 💡 Feature Request\n\n**Summary:** {{summary}}\n\n**Problem Statement:** {{problemStatement}}\n\n**Proposed Solution:** {{proposedSolution}}\n\n",
      additional: {
        useCases:
          "## 👥 Use Cases\n\n{{#each useCases}}\n- **{{this.userType}}**: {{this.goal}} → {{this.benefit}}\n{{/each}}\n\n",
        impact:
          "## 📊 Impact\n\n- **Potential Users:** {{impact.potentialUsers}}\n- **Business Value:** {{impact.businessValue}}\n- **Technical Complexity:** {{impact.technicalComplexity}}\n{{#if impact.dependencies}}\n- **Dependencies:** {{impact.dependencies}}\n{{/if}}\n\n",
        requirements:
          "## ⚙️ Technical Requirements\n\n{{#each technicalRequirements}}\n- {{this}}\n{{/each}}\n\n",
        alternatives:
          "{{#if alternativesConsidered}}## 🤔 Alternatives Considered\n\n{{alternativesConsidered}}\n\n{{/if}}",
      },
    },
    validation: {
      fields: [
        {
          field: "problemStatement",
          required: true,
          minLength: 20,
          errorMessage: "Problem statement must be at least 20 characters",
        },
        {
          field: "proposedSolution",
          required: true,
          minLength: 20,
          errorMessage: "Proposed solution must be at least 20 characters",
        },
      ],
    },
  },
};
