import type { SelectOption } from "@/design-system/components/Select";

import type { FieldConfig, FieldValue, UiOptionCatalog } from "./entityTypes";

const FALLBACK_SERVICE_LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C#",
];

const FALLBACK_SERVICE_FRAMEWORKS: Record<string, string[]> = {
  TypeScript: ["NestJS", "Fastify", "Express"],
  JavaScript: ["Express", "Koa", "Hapi"],
  Python: ["FastAPI", "Django", "Flask"],
  Go: ["Gin", "Echo", "Fiber"],
  Rust: ["Actix", "Axum", "Rocket"],
  Java: ["Spring Boot", "Micronaut", "Quarkus"],
  "C#": ["ASP.NET Core", "NancyFX"],
};

const cleanString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildServiceLanguages = (catalog: UiOptionCatalog): string[] => {
  const candidateLanguages = new Set<string>();
  const push = (value: string | null) => {
    if (value) {
      candidateLanguages.add(value);
    }
  };

  (catalog.serviceLanguages ?? FALLBACK_SERVICE_LANGUAGES).forEach((value) =>
    push(cleanString(value)),
  );

  Object.keys(catalog.serviceFrameworks ?? {}).forEach((language) => push(cleanString(language)));

  FALLBACK_SERVICE_LANGUAGES.forEach((value) => push(value));

  const merged = Array.from(candidateLanguages).filter(Boolean) as string[];
  merged.sort((a, b) => a.localeCompare(b));
  return merged;
};

const buildServiceFrameworkMap = (catalog: UiOptionCatalog): Record<string, string[]> => {
  const frameworks: Record<string, string[]> = {};

  const sourceMaps = [catalog.serviceFrameworks ?? {}, FALLBACK_SERVICE_FRAMEWORKS];
  sourceMaps.forEach((map) => {
    Object.entries(map).forEach(([rawLanguage, entries]) => {
      const language = cleanString(rawLanguage);
      if (!language) return;
      const normalizedEntries = (entries || [])
        .map((entry) => cleanString(entry))
        .filter((entry): entry is string => Boolean(entry));
      if (normalizedEntries.length === 0) return;
      frameworks[language] = Array.from(
        new Set([...(frameworks[language] ?? []), ...normalizedEntries]),
      );
    });
  });

  return frameworks;
};

const buildFrameworkResolver = (frameworks: Record<string, string[]>) => {
  return (languageValue: FieldValue | undefined): Array<string | SelectOption> => {
    const language = cleanString(
      typeof languageValue === "string"
        ? languageValue
        : Array.isArray(languageValue)
          ? (languageValue[0] as string | undefined)
          : typeof languageValue === "object" && languageValue && "value" in languageValue
            ? ((languageValue as Record<string, unknown>).value as string | undefined)
            : undefined,
    );
    if (!language) {
      return [];
    }
    return (frameworks[language] ?? []).map((framework) => ({
      value: framework,
      label: framework,
    }));
  };
};

export const buildServiceFieldConfig = (catalog: UiOptionCatalog): FieldConfig[] => {
  const serviceLanguages = buildServiceLanguages(catalog);
  const serviceFrameworks = buildServiceFrameworkMap(catalog);
  const frameworkOptionsFor = buildFrameworkResolver(serviceFrameworks);

  return [
    { name: "name", label: "Service Name", required: true, placeholder: "payments-service" },
    serviceLanguages.length > 0
      ? {
          name: "language",
          label: "Language",
          type: "select",
          options: serviceLanguages,
          placeholder: "Select language",
          required: true,
          onChangeClear: ["framework"],
        }
      : {
          name: "language",
          label: "Language",
          required: true,
          placeholder: "Node.js, Go, Python",
          onChangeClear: ["framework"],
        },
    {
      name: "framework",
      label: "Framework (optional)",
      type: "select",
      placeholder: "Select framework",
      resolveOptions: (values: Record<string, FieldValue>) =>
        frameworkOptionsFor(values["language"]),
      isVisible: (_: Record<string, FieldValue>, resolvedOptions: Array<string | SelectOption>) =>
        resolvedOptions.length > 0,
      description: "Optional: choose a framework that fits the selected language.",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      placeholder: "What responsibilities does this service own?",
    },
    {
      name: "environmentVariables",
      label: "Environment Variables",
      component: "key-value",
      defaultValue: [],
      keyPlaceholder: "KEY",
      valuePlaceholder: "Value",
      addLabel: "Add variable",
      description: "Optional: define key/value pairs to capture runtime configuration.",
    },
  ].filter(Boolean) as FieldConfig[];
};
