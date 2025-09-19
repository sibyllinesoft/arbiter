import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Current directory:", __dirname);
const rootPackagePath = path.resolve(__dirname, "package.json");
const cliPackagePath = path.resolve(__dirname, "packages/cli/package.json");
console.log("Root package path:", rootPackagePath);
console.log("CLI package path:", cliPackagePath);

try {
  const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, "utf-8"));
  console.log("Root version:", rootPackage.version);
} catch (e) {
  console.log("Root package error:", e.message);
}

try {
  const cliPackage = JSON.parse(fs.readFileSync(cliPackagePath, "utf-8"));
  console.log("CLI version:", cliPackage.version);
} catch (e) {
  console.log("CLI package error:", e.message);
}

// Test the same logic as in the CLI
const loadPackageInfo = () => {
  try {
    let rootPackage = null;
    let cliPackage = null;

    try {
      rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, "utf-8"));
    } catch {
      console.log("Failed to load root package");
    }

    try {
      cliPackage = JSON.parse(fs.readFileSync(cliPackagePath, "utf-8"));
    } catch {
      console.log("Failed to load CLI package");
    }

    return {
      name: "arbiter",
      version: rootPackage?.version || cliPackage?.version || "0.1.0",
      description: cliPackage?.description || "Arbiter CLI for CUE validation and management",
    };
  } catch (error) {
    console.log("Error in loadPackageInfo:", error.message);
    return {
      name: "arbiter",
      version: "0.1.0",
      description: "Arbiter CLI for CUE validation and management",
    };
  }
};

const packageJson = loadPackageInfo();
console.log("Final package info:", packageJson);
