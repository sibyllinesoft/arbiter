/**
 * Node.js + Express Backend Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const backendDir = data.backendDir || "backend";

  return [
    {
      type: "addMany",
      destination: `{{projectDir}}/${backendDir}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Node.js backend with Express and TypeScript";

export const dependencies = {
  express: "^4.18.0",
  cors: "^2.8.5",
  dotenv: "^16.3.0",
  helmet: "^7.1.0",
  "express-rate-limit": "^7.1.0",
};

export const devDependencies = {
  "@types/express": "^4.17.0",
  "@types/cors": "^2.8.0",
  "@types/node": "^20.10.0",
  typescript: "^5.3.0",
  "ts-node": "^10.9.0",
  nodemon: "^3.0.0",
};

export const scripts = {
  "dev:backend": "nodemon --exec ts-node backend/src/index.ts",
  "build:backend": "tsc -p backend/tsconfig.json",
  "start:backend": "node backend/dist/index.js",
};

export const envVars = {
  PORT: "3000",
  NODE_ENV: "development",
};
