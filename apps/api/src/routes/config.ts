import path from "path";
import {
  ARRAY_UI_OPTION_KEYS,
  DEFAULT_UI_OPTION_CATALOG,
  type UIArrayOptionKey,
  type UIOptionCatalog,
  type UIOptionGeneratorMap,
  UI_OPTION_KEYS,
  buildUIOptionConfig,
  resolveUIOptionCatalog,
} from "@arbiter/shared";
import fs from "fs-extra";
import { Hono } from "hono";
import yaml from "yaml";

type Dependencies = Record<string, unknown>;

type ConfigFormat = "json" | "yaml";

type ProjectStructureSettings = {
  appsDirectory: string;
  packagesDirectory: string;
  servicesDirectory: string;
  testsDirectory: string;
  infraDirectory: string;
  docsDirectory: string;
  packageRelative?: {
    docsDirectory?: boolean;
    testsDirectory?: boolean;
    infraDirectory?: boolean;
  };
};

const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
const CONFIG_SEARCH_PATHS = [".arbiter/config.json"] as const;

const DEFAULT_PROJECT_STRUCTURE: ProjectStructureSettings = {
  appsDirectory: "apps",
  packagesDirectory: "packages",
  servicesDirectory: "services",
  docsDirectory: "docs",
  testsDirectory: "tests",
  infraDirectory: "infra",
  packageRelative: {
    docsDirectory: false,
    testsDirectory: false,
    infraDirectory: false,
  },
};

function coerceStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const result = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
    return result.length > 0 ? result : undefined;
  }
  if (typeof value === "string") {
    const items = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

function coerceFrameworkMap(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const result: Record<string, string[]> = {};

  for (const [rawLanguage, rawFrameworks] of Object.entries(record)) {
    if (typeof rawLanguage !== "string") continue;
    const language = rawLanguage.trim();
    if (!language) continue;

    const frameworks = coerceStringArray(rawFrameworks);
    if (frameworks !== undefined) {
      result[language] = frameworks;
    } else if (Array.isArray(rawFrameworks) && rawFrameworks.length === 0) {
      result[language] = [];
    }
  }

  return Object.keys(result).length > 0 ? result : {};
}

function extractOptionCatalog(raw: unknown): UIOptionCatalog | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Record<string, unknown>;
  const catalog: UIOptionCatalog = {};

  for (const key of ARRAY_UI_OPTION_KEYS) {
    const values = coerceStringArray(source[key]);
    if (values) {
      (catalog as Record<UIArrayOptionKey, string[]>)[key] = values;
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, "serviceFrameworks")) {
    const frameworks = coerceFrameworkMap(source["serviceFrameworks"]);
    if (frameworks !== undefined) {
      catalog.serviceFrameworks = frameworks;
    }
  }

  return Object.keys(catalog).length > 0 ? catalog : undefined;
}

function extractOptionGenerators(raw: unknown): UIOptionGeneratorMap | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Record<string, unknown>;
  const generators: UIOptionGeneratorMap = {};
  for (const key of UI_OPTION_KEYS) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      generators[key] = value.trim();
    }
  }
  return Object.keys(generators).length > 0 ? generators : undefined;
}

interface LoadedConfig {
  config: Record<string, unknown>;
  filePath: string;
  format: ConfigFormat;
}

function resolveDefaultConfigPath(): string {
  return path.join(PROJECT_ROOT, ".arbiter", "config.json");
}

async function findExistingConfig(): Promise<LoadedConfig | null> {
  for (const relativePath of CONFIG_SEARCH_PATHS) {
    const filePath = path.join(PROJECT_ROOT, relativePath);
    if (await fs.pathExists(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const format: ConfigFormat = ext === ".json" ? "json" : "yaml";
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = format === "json" ? JSON.parse(content) : (yaml.parse(content) ?? {});
      return { config: parsed as Record<string, unknown>, filePath, format };
    }
  }
  return null;
}

function sanitizeStructureCandidate(value: unknown): Partial<ProjectStructureSettings> {
  if (!value || typeof value !== "object") return {};

  const result: Partial<ProjectStructureSettings> = {};
  const record = value as Record<string, unknown>;

  const stringKeys: Array<keyof ProjectStructureSettings> = [
    "appsDirectory",
    "packagesDirectory",
    "servicesDirectory",
    "docsDirectory",
    "testsDirectory",
    "infraDirectory",
  ];

  stringKeys.forEach((key) => {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      result[key] = candidate.trim();
    }
  });

  const packageRelative = record.packageRelative;
  if (packageRelative && typeof packageRelative === "object") {
    const clean: Record<string, boolean> = {};
    for (const key of ["docsDirectory", "testsDirectory", "infraDirectory"] as const) {
      const raw = (packageRelative as Record<string, unknown>)[key];
      if (typeof raw === "boolean") {
        clean[key] = raw;
      }
    }
    if (Object.keys(clean).length > 0) {
      result.packageRelative = clean as ProjectStructureSettings["packageRelative"];
    }
  }

  return result;
}

async function loadProjectStructureConfig(): Promise<
  LoadedConfig & { structure: ProjectStructureSettings }
> {
  const existing = await findExistingConfig();

  if (existing) {
    const existingStructure = sanitizeStructureCandidate(
      (existing.config as Record<string, unknown>)["projectStructure"],
    );

    return {
      ...existing,
      structure: {
        ...DEFAULT_PROJECT_STRUCTURE,
        ...existingStructure,
        packageRelative: {
          ...DEFAULT_PROJECT_STRUCTURE.packageRelative,
          ...(existingStructure.packageRelative ?? {}),
        },
      },
    };
  }

  return {
    config: {},
    filePath: resolveDefaultConfigPath(),
    format: "json",
    structure: { ...DEFAULT_PROJECT_STRUCTURE },
  };
}

async function persistProjectStructure(
  updates: Partial<ProjectStructureSettings>,
): Promise<ProjectStructureSettings> {
  const loaded = await loadProjectStructureConfig();
  const sanitizedUpdates = sanitizeStructureCandidate(updates);
  const existingStructure = sanitizeStructureCandidate(
    (loaded.config as Record<string, unknown>)["projectStructure"],
  );

  const updatedStructure: ProjectStructureSettings = {
    ...DEFAULT_PROJECT_STRUCTURE,
    ...existingStructure,
    ...sanitizedUpdates,
    packageRelative: {
      ...DEFAULT_PROJECT_STRUCTURE.packageRelative,
      ...(existingStructure.packageRelative ?? {}),
      ...(sanitizedUpdates.packageRelative ?? {}),
    },
  };

  const configToWrite: Record<string, unknown> = {
    ...loaded.config,
    projectStructure: updatedStructure,
  };

  await fs.ensureDir(path.dirname(loaded.filePath));
  if (loaded.format === "json") {
    await fs.writeFile(loaded.filePath, JSON.stringify(configToWrite, null, 2), "utf-8");
  } else {
    await fs.writeFile(loaded.filePath, yaml.stringify(configToWrite), "utf-8");
  }

  return updatedStructure;
}

export function createConfigRouter(_: Dependencies) {
  const router = new Hono();

  router.get("/config/project-structure", async (c) => {
    try {
      const loaded = await loadProjectStructureConfig();
      return c.json({
        success: true,
        projectStructure: loaded.structure,
      });
    } catch (error) {
      console.error("Failed to load project structure config:", error);
      return c.json(
        {
          success: false,
          error: "Failed to load project structure configuration",
        },
        500,
      );
    }
  });

  router.put("/config/project-structure", async (c) => {
    try {
      const body = await c.req.json();
      if (!body || typeof body !== "object") {
        return c.json(
          {
            success: false,
            error: "Request body must be an object",
          },
          400,
        );
      }

      const updated = await persistProjectStructure(body as Partial<ProjectStructureSettings>);
      return c.json({ success: true, projectStructure: updated });
    } catch (error) {
      console.error("Failed to update project structure config:", error);
      return c.json(
        {
          success: false,
          error: "Failed to update project structure configuration",
        },
        500,
      );
    }
  });

  router.get("/config/ui-options", async (c) => {
    try {
      const loaded = await findExistingConfig();
      const rawConfig = loaded?.config ?? {};
      const optionCatalog =
        extractOptionCatalog((rawConfig as Record<string, unknown>)["uiOptions"]) ||
        DEFAULT_UI_OPTION_CATALOG;
      const optionGenerators = extractOptionGenerators(
        (rawConfig as Record<string, unknown>)["uiOptionGenerators"],
      );

      const optionConfig = buildUIOptionConfig(optionCatalog, optionGenerators);
      const { catalog, diagnostics } = await resolveUIOptionCatalog(optionConfig, {
        baseDir: loaded ? path.dirname(loaded.filePath) : PROJECT_ROOT,
      });

      const finalCatalog: UIOptionCatalog = {
        ...DEFAULT_UI_OPTION_CATALOG,
        ...catalog,
      };

      return c.json({
        success: true,
        options: finalCatalog,
        diagnostics,
      });
    } catch (error) {
      console.error("Failed to load UI options:", error);
      return c.json(
        {
          success: false,
          error: "Failed to load UI options",
        },
        500,
      );
    }
  });

  return router;
}
