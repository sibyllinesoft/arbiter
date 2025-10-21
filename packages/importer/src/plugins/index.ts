/**
 * @packageDocumentation
 * Exposes the built-in importer plugins.
 */

import { DockerPlugin } from "./docker";
import { goPlugin } from "./go";
import { KubernetesPlugin } from "./kubernetes";
import { NodeJSPlugin } from "./nodejs";
import { pythonPlugin } from "./python";
import { rustPlugin } from "./rust";
import { TerraformPlugin } from "./terraform";

/**
 * Returns all bundled importer plugins in their recommended registration order.
 */
export function getAllPlugins() {
  return [
    new DockerPlugin(),
    new NodeJSPlugin(),
    new KubernetesPlugin(),
    new TerraformPlugin(),
    rustPlugin,
    pythonPlugin,
    goPlugin,
  ];
}
