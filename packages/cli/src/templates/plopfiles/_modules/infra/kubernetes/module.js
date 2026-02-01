/**
 * Kubernetes Infrastructure Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  return [
    {
      type: "addMany",
      destination: "{{projectDir}}",
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Kubernetes deployment manifests";

export const scripts = {
  "k8s:apply": "kubectl apply -k k8s/overlays/dev",
  "k8s:delete": "kubectl delete -k k8s/overlays/dev",
  "k8s:logs": "kubectl logs -l app={{kebabCase name}} -f",
};
