import chalk from 'chalk';
import { ApiClient } from '../api-client.js';
import type { CLIConfig } from '../config.js';
import { formatComponentTable, formatJson, formatYaml } from '../utils/formatting.js';
import { withProgress } from '../utils/progress.js';

export interface ListOptions {
  // No additional options for now, but extensible
}

const VALID_TYPES = [
  'service',
  'endpoint',
  'route',
  'model',
  'event',
  'job',
  'middleware',
  'config',
  'deployment',
  'component',
  'package',
  'flow',
  'locator',
  'schema',
  'cache',
  'database',
  'load-balancer',
] as const;

type ValidType = (typeof VALID_TYPES)[number];

export async function listCommand(
  type: string,
  options: ListOptions,
  config: CLIConfig
): Promise<number> {
  try {
    // Validate type parameter
    if (!VALID_TYPES.includes(type as ValidType)) {
      console.error(chalk.red(`Invalid type: ${type}`));
      console.error(chalk.gray(`Valid types: ${VALID_TYPES.join(', ')}`));
      return 1;
    }

    const client = new ApiClient(config);

    // List components with progress indicator
    const result = await withProgress(`Listing ${type}s...`, () => client.listComponents(type));

    if (!result.success) {
      console.error(chalk.red('List failed:'), result.error);
      return 1;
    }

    const components = result.data || [];

    // Handle empty results
    if (components.length === 0) {
      console.log(chalk.yellow(`No ${type}s found`));
      return 0;
    }

    // Format and display results based on output format
    switch (config.format) {
      case 'json':
        console.log(formatJson(components));
        break;
      case 'yaml':
        console.log(formatYaml(components));
        break;
      case 'table':
      default:
        console.log(formatComponentTable(components));
        break;
    }

    // Show summary if verbose
    if (config.verbose) {
      console.log(chalk.gray(`\nFound ${components.length} ${type}(s)`));
    }

    return 0;
  } catch (error) {
    console.error(chalk.red('List command failed:'), error.message);
    return 2;
  }
}
