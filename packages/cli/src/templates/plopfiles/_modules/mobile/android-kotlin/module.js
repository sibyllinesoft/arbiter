/**
 * Android Kotlin Mobile Module
 * Modern Android app with Jetpack Compose
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const mobileDir = data.mobileDir || "android";

  return [
    {
      type: "addMany",
      destination: `{{projectDir}}/${mobileDir}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data: {
        ...data,
        packageName:
          data.packageName || `com.example.${data.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      },
    },
  ];
}

export const description = "Native Android app with Kotlin and Jetpack Compose";

export const scripts = {
  "dev:android": "cd android && ./gradlew installDebug",
  "build:android": "cd android && ./gradlew assembleRelease",
  "test:android": "cd android && ./gradlew test",
  "lint:android": "cd android && ./gradlew lint",
};
