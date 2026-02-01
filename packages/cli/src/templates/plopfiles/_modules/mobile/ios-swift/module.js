/**
 * iOS Swift Mobile Module
 * Modern iOS app with SwiftUI
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const mobileDir = data.mobileDir || "ios";

  return [
    {
      type: "addMany",
      destination: `{{projectDir}}/${mobileDir}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data: {
        ...data,
        bundleId:
          data.bundleId || `com.example.${data.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      },
    },
  ];
}

export const description = "Native iOS app with Swift and SwiftUI";

export const scripts = {
  "dev:ios":
    "cd ios && xcodebuild -scheme App -destination 'platform=iOS Simulator,name=iPhone 15' -configuration Debug build",
  "build:ios": "cd ios && xcodebuild -scheme App -configuration Release archive",
  "test:ios":
    "cd ios && xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=iPhone 15'",
};
