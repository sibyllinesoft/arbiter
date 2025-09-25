// Plugin index and registry for the importer

import { DockerPlugin } from './docker.js';
import { goPlugin } from './go';
import { KubernetesPlugin } from './kubernetes.js';
import { NodeJSPlugin } from './nodejs.js';
import { pythonPlugin } from './python';
import { rustPlugin } from './rust';
import { TerraformPlugin } from './terraform.js';

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
