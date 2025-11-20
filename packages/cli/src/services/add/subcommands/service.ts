import chalk from "chalk";
import type { PlatformServiceType, RouteConfig, ServiceConfig } from "../../../cue/index.js";
import { detectPlatform, getPlatformServiceDefaults } from "../../../utils/platform-detection.js";
import { toTitleCase } from "../shared.js";
import { executeTemplate, validateTemplateExists } from "../template-engine.js";

interface ServiceTemplateOptions {
  language?: string;
  port?: number;
  image?: string;
  directory?: string;
  template?: string;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
  serviceType?: PlatformServiceType;
  [key: string]: any;
}

export async function addService(
  manipulator: any,
  content: string,
  serviceName: string,
  options: ServiceTemplateOptions,
): Promise<string> {
  const { language = "typescript", port, image, directory, template } = options;

  if (template) {
    return await addServiceWithTemplate(manipulator, content, serviceName, options);
  }

  let platformContext;
  if (!options.platform && !options.serviceType) {
    platformContext = await detectPlatform();

    if (platformContext.detected !== "unknown" && platformContext.confidence > 0.3) {
      console.log(
        chalk.cyan(
          `🔍 Detected ${platformContext.detected} platform (${Math.round(platformContext.confidence * 100)}% confidence)`,
        ),
      );

      if (platformContext.suggestions.length > 0) {
        console.log(chalk.dim("💡 Platform-specific suggestions:"));
        for (const suggestion of platformContext.suggestions) {
          console.log(
            chalk.dim(`  • Use --service-type ${suggestion.serviceType} for ${suggestion.reason}`),
          );
        }
        console.log(
          chalk.dim("  • Or use --platform kubernetes for traditional container deployment"),
        );
      }
    }
  }

  const isPrebuilt = !!image;
  let serviceConfig: ServiceConfig;

  if (options.serviceType) {
    const platformDefaults = getPlatformServiceDefaults(options.serviceType);
    serviceConfig = {
      serviceType: options.serviceType,
      type: platformDefaults.artifactType || "external",
      language: platformDefaults.language || language,
      workload: platformDefaults.workload || "serverless",
      ...(platformDefaults.platform && { platform: platformDefaults.platform }),
      ...(platformDefaults.runtime && { runtime: platformDefaults.runtime }),
      ...(directory && { sourceDirectory: directory }),
      ...(port && { ports: [{ name: "http", port, targetPort: port }] }),
    };
  } else if (isPrebuilt) {
    serviceConfig = {
      type: "external",
      language: "container",
      workload:
        image && (image.includes("postgres") || image.includes("mysql"))
          ? "statefulset"
          : "deployment",
      image: image!,
      ...(port && { ports: [{ name: "main", port, targetPort: port }] }),
    };
  } else {
    serviceConfig = {
      type: "internal",
      language,
      workload: "deployment",
      sourceDirectory: directory || `./src/${serviceName}`,
      ...(port && { ports: [{ name: "http", port, targetPort: port }] }),
    };
  }

  let updatedContent = await manipulator.addService(content, serviceName, serviceConfig);

  if (!isPrebuilt && (language === "typescript" || language === "javascript")) {
    const routeConfig: RouteConfig = {
      id: `${serviceName}:main`,
      path: port === 3000 ? "/" : `/${serviceName}`,
      capabilities: ["view"],
      components: [`${toTitleCase(serviceName)}Page`],
    };
    updatedContent = await manipulator.addRoute(updatedContent, routeConfig);

    const locatorKey = `page:${serviceName}`;
    const locatorValue = `[data-testid="${serviceName}-page"]`;
    updatedContent = await manipulator.addToSection(
      updatedContent,
      "locators",
      locatorKey,
      locatorValue,
    );
  }

  return updatedContent;
}

async function addServiceWithTemplate(
  manipulator: any,
  content: string,
  serviceName: string,
  options: ServiceTemplateOptions,
): Promise<string> {
  const { template, directory = `./src/${serviceName}` } = options;

  if (!template) {
    throw new Error("Template name is required for template-based generation");
  }

  try {
    await validateTemplateExists(template);
    await executeTemplate(serviceName, template, content, directory, options);
    const serviceConfig = createTemplateServiceConfig(serviceName, directory, options);

    let updatedContent = await manipulator.addService(content, serviceName, serviceConfig);

    if (shouldAddUIComponents(options)) {
      updatedContent = await addUIComponentsForService(
        manipulator,
        updatedContent,
        serviceName,
        options,
      );
    }

    return updatedContent;
  } catch (error) {
    throw new Error(
      `Template generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function createTemplateServiceConfig(
  serviceName: string,
  directory: string,
  options: ServiceTemplateOptions,
): ServiceConfig {
  return {
    type: "internal",
    language: options.language || "typescript",
    workload: "deployment",
    sourceDirectory: directory,
    template: options.template!,
    ...(options.port && {
      ports: [{ name: "http", port: options.port, targetPort: options.port }],
    }),
  };
}

function shouldAddUIComponents(options: ServiceTemplateOptions): boolean {
  return !options.image && (options.language === "typescript" || options.language === "javascript");
}

async function addUIComponentsForService(
  manipulator: any,
  content: string,
  serviceName: string,
  options: ServiceTemplateOptions,
): Promise<string> {
  const routeConfig: RouteConfig = {
    id: `${serviceName}:main`,
    path: options.port === 3000 ? "/" : `/${serviceName}`,
    capabilities: ["view"],
    components: [`${toTitleCase(serviceName)}Page`],
  };

  let updatedContent = await manipulator.addRoute(content, routeConfig);

  const locatorKey = `page:${serviceName}`;
  const locatorValue = `[data-testid="${serviceName}-page"]`;
  updatedContent = await manipulator.addToSection(
    updatedContent,
    "locators",
    locatorKey,
    locatorValue,
  );

  return updatedContent;
}
