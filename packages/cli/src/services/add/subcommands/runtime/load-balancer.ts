/**
 * @packageDocumentation
 * Load balancer subcommand module - Handles adding load balancers to CUE specifications.
 *
 * Creates nginx-based load balancers with:
 * - Target service routing
 * - Health check configuration
 * - Container deployment settings
 */

import type { ServiceConfig } from "@/cue/index.js";

/** Options for load balancer configuration */
interface LoadBalancerOptions {
  target?: string;
  healthCheck?: string;
  [key: string]: any;
}

/** Internal normalized load balancer parameters */
interface LoadBalancerParams {
  target: string;
  healthCheck: string;
}

/**
 * Add a load balancer service to the CUE specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param options - Load balancer configuration options
 * @returns Updated CUE file content
 */
export async function addLoadBalancer(
  manipulator: any,
  content: string,
  options: LoadBalancerOptions,
): Promise<string> {
  const params = validateAndNormalizeLoadBalancerOptions(options);
  await ensureTargetServiceExists(manipulator, content, params.target);

  return await createLoadBalancerWithHealthCheck(manipulator, content, params);
}

/**
 * Validate and normalize load balancer options.
 * @param options - User-provided load balancer options
 * @returns Normalized load balancer parameters
 */
function validateAndNormalizeLoadBalancerOptions(options: LoadBalancerOptions): LoadBalancerParams {
  const { target, healthCheck = "/health" } = options;

  if (!target) {
    throw new Error("Load balancer requires --target service");
  }

  return { target, healthCheck };
}

/**
 * Ensure the target service exists in the specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param target - Target service name
 */
async function ensureTargetServiceExists(
  manipulator: any,
  content: string,
  target: string,
): Promise<void> {
  const targetExists = await validateTargetServiceExists(manipulator, content, target);
  if (!targetExists) {
    throw new Error(`Target service "${target}" not found`);
  }
}

/**
 * Validate that the target service exists in the CUE specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param target - Target service name to validate
 * @returns True if the target service exists
 */
async function validateTargetServiceExists(
  manipulator: any,
  content: string,
  target: string,
): Promise<boolean> {
  try {
    const ast = await manipulator.parse(content);
    return Boolean(ast.services?.[target]);
  } catch {
    return content.includes(`${target}:`);
  }
}

/**
 * Create a load balancer service with health check configuration.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param params - Normalized load balancer parameters
 * @returns Updated CUE file content
 */
async function createLoadBalancerWithHealthCheck(
  manipulator: any,
  content: string,
  params: LoadBalancerParams,
): Promise<string> {
  const lbConfig = createLoadBalancerConfig();
  let updatedContent = await manipulator.addService(content, "loadbalancer", lbConfig);

  updatedContent = await addHealthCheckToTarget(
    manipulator,
    updatedContent,
    params.target,
    params.healthCheck,
  );

  return updatedContent;
}

/**
 * Create the service configuration for the load balancer.
 * @returns Service configuration object for nginx-based load balancer
 */
function createLoadBalancerConfig(): ServiceConfig {
  return {
    type: "external",
    language: "container",
    workload: "deployment",
    image: "nginx:alpine",
    ports: [{ name: "http", port: 80, targetPort: 80 }],
    template: "nginx-loadbalancer",
  };
}

/**
 * Add a health check configuration to the target service.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param target - Target service name
 * @param healthCheck - Health check endpoint path
 * @returns Updated CUE file content
 */
async function addHealthCheckToTarget(
  manipulator: any,
  content: string,
  target: string,
  healthCheck: string,
): Promise<string> {
  try {
    const ast = await manipulator.parse(content);
    if (!ast.services[target].healthCheck) {
      ast.services[target].healthCheck = {
        path: healthCheck,
        port: 3000,
      };
      return await manipulator.serialize(ast, content);
    }
  } catch (error) {
    console.warn(`Could not add health check to target service ${target}`);
  }
  return content;
}
