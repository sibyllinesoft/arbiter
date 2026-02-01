/**
 * React Native Mobile Module
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

export const description = "React Native mobile app with Expo and TypeScript";

export const scripts = {
  "dev:mobile": "cd mobile && npx expo start",
  "build:mobile:ios": "cd mobile && npx eas build --platform ios",
  "build:mobile:android": "cd mobile && npx eas build --platform android",
};

export const envVars = {
  EXPO_PUBLIC_API_URL: "http://localhost:3000",
};
