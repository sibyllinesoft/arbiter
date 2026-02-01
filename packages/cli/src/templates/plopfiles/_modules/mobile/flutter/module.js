/**
 * Flutter Mobile Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const mobileDir = data.mobileDir || "mobile";

  return [
    {
      type: "addMany",
      destination: `{{projectDir}}/${mobileDir}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Flutter mobile app with Dart";

export const scripts = {
  "dev:mobile": "cd mobile && flutter run",
  "build:mobile:ios": "cd mobile && flutter build ios",
  "build:mobile:android": "cd mobile && flutter build apk",
};

export const envVars = {
  FLUTTER_API_URL: "http://localhost:3000",
};
