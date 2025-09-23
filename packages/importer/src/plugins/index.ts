import { DockerPlugin } from './docker';
import { KubernetesPlugin } from './kubernetes';
import { NodeJSPlugin } from './nodejs';
import { RustPlugin } from './rust';
import { TerraformPlugin } from './terraform';

export function getAllPlugins() {
  return [
    new NodeJSPlugin(),
    new DockerPlugin(),
    new KubernetesPlugin(),
    new TerraformPlugin(),
    new RustPlugin(),
  ];
}
