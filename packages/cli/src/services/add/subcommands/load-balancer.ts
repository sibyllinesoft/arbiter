import type { ServiceConfig } from "../../../cue/index.js";

interface LoadBalancerOptions {
  target?: string;
  healthCheck?: string;
  [key: string]: any;
}

interface LoadBalancerParams {
  target: string;
  healthCheck: string;
}

export async function addLoadBalancer(
  manipulator: any,
  content: string,
  options: LoadBalancerOptions,
): Promise<string> {
  const params = validateAndNormalizeLoadBalancerOptions(options);
  await ensureTargetServiceExists(manipulator, content, params.target);

  return await createLoadBalancerWithHealthCheck(manipulator, content, params);
}

function validateAndNormalizeLoadBalancerOptions(options: LoadBalancerOptions): LoadBalancerParams {
  const { target, healthCheck = "/health" } = options;

  if (!target) {
    throw new Error("Load balancer requires --target service");
  }

  return { target, healthCheck };
}

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
