// Plugin index and registry for the importer

import { DockerPlugin } from './docker';
import { goPlugin } from './go';
import { KubernetesPlugin } from './kubernetes';
import { NodeJSPlugin } from './nodejs';
import { pythonPlugin } from './python';
import { rustPlugin } from './rust';
import { TerraformPlugin } from './terraform';

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
