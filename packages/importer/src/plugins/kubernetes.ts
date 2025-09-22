/**
 * Kubernetes Plugin for Brownfield Detection
 *
 * Comprehensive plugin for detecting Kubernetes artifacts including deployments,
 * services, ingresses, and other K8s resources. Analyzes YAML manifests to
 * infer application architecture and deployment patterns.
 */

import * as path from 'path';
import * as yaml from 'yaml';
import {
  ConfidenceScore,
  DatabaseArtifact,
  DeploymentArtifact,
  Evidence,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
  Provenance,
  ServiceArtifact,
} from '../types.js';

// ============================================================================
// Kubernetes Resource Types and Patterns
// ============================================================================

const K8S_WORKLOAD_TYPES = [
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'Job',
  'CronJob',
  'ReplicaSet',
  'Pod',
];

const K8S_SERVICE_TYPES = ['Service', 'Ingress', 'NetworkPolicy'];

const K8S_CONFIG_TYPES = [
  'ConfigMap',
  'Secret',
  'PersistentVolume',
  'PersistentVolumeClaim',
  'ServiceAccount',
];

const DATABASE_IMAGES = [
  'postgres',
  'mysql',
  'mongodb',
  'redis',
  'elasticsearch',
  'cassandra',
  'memcached',
  'mariadb',
];

// ============================================================================
// Types for structured evidence data
// ============================================================================

interface K8sResourceData extends Record<string, unknown> {
  configType: string;
  kind: string;
  apiVersion: string;
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  spec: any;
  status?: any;
}

interface K8sWorkloadData extends K8sResourceData {
  containers: Array<{
    name: string;
    image: string;
    ports: Array<{ containerPort: number; protocol?: string; name?: string }>;
    env: Array<{ name: string; value?: string; valueFrom?: any }>;
    resources?: {
      requests?: Record<string, string>;
      limits?: Record<string, string>;
    };
    readinessProbe?: any;
    livenessProbe?: any;
  }>;
  replicas?: number;
  selector?: { matchLabels?: Record<string, string> };
  strategy?: any;
  volumes?: Array<{ name: string; [key: string]: any }>;
}

interface K8sServiceData extends K8sResourceData {
  type: string;
  ports: Array<{
    port: number;
    targetPort?: number | string;
    protocol?: string;
    name?: string;
  }>;
  selector?: Record<string, string>;
  clusterIP?: string;
  loadBalancerIP?: string;
  externalName?: string;
}

interface K8sIngressData extends K8sResourceData {
  rules: Array<{
    host?: string;
    paths?: Array<{
      path?: string;
      pathType?: string;
      backend: {
        service?: { name: string; port: number | string };
      };
    }>;
  }>;
  tls?: Array<{
    hosts?: string[];
    secretName?: string;
  }>;
}

// ============================================================================
// Main Plugin Implementation
// ============================================================================

export class KubernetesPlugin implements ImporterPlugin {
  name(): string {
    return 'kubernetes';
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();

    // Support YAML files in kubernetes directories
    if (
      (extension === '.yaml' || extension === '.yml') &&
      (filePath.includes('kubernetes') ||
        filePath.includes('k8s') ||
        filePath.includes('manifests') ||
        fileName.includes('k8s'))
    ) {
      return true;
    }

    // Support files with k8s in the name
    if (
      (extension === '.yaml' || extension === '.yml') &&
      (fileName.includes('deployment') ||
        fileName.includes('service') ||
        fileName.includes('ingress') ||
        fileName.includes('configmap'))
    ) {
      return true;
    }

    // Content-based detection - check for apiVersion and kind
    if (fileContent && (extension === '.yaml' || extension === '.yml')) {
      return /apiVersion:\s*[\w\/]+/.test(fileContent) && /kind:\s*\w+/.test(fileContent);
    }

    return false;
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent) return [];

    const evidence: Evidence[] = [];
    const baseId = `k8s-${path.relative(context?.projectRoot || '', filePath)}`;

    try {
      // Parse YAML content - may contain multiple documents
      const documents = yaml.parseAllDocuments(fileContent);

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        if (doc.errors.length > 0) continue;

        const resource = doc.toJS();
        if (!resource || !resource.apiVersion || !resource.kind) continue;

        const docId = `${baseId}-${i}`;
        evidence.push(...(await this.parseK8sResource(filePath, resource, docId)));
      }
    } catch (error) {
      console.warn(`Kubernetes plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const k8sEvidence = evidence.filter(e => e.source === 'kubernetes');
    if (k8sEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    try {
      // Infer from workload resources (Deployment, StatefulSet, etc.)
      const workloadEvidence = k8sEvidence.filter(
        e => e.type === 'deployment' && K8S_WORKLOAD_TYPES.includes((e.data as any).kind as string)
      );
      for (const workload of workloadEvidence) {
        artifacts.push(...(await this.inferFromWorkload(workload, k8sEvidence, context)));
      }

      // Infer deployment artifacts from the overall manifest set
      if (k8sEvidence.length > 0) {
        artifacts.push(...(await this.inferDeploymentArtifact(k8sEvidence, context)));
      }
    } catch (error) {
      console.warn('Kubernetes plugin inference failed:', error);
    }

    return artifacts;
  }

  // ============================================================================
  // Private parsing methods
  // ============================================================================

  private async parseK8sResource(
    filePath: string,
    resource: any,
    baseId: string
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    const { apiVersion, kind, metadata = {}, spec = {}, status } = resource;

    const baseData: K8sResourceData = {
      configType: 'k8s-resource',
      kind,
      apiVersion,
      name: (metadata.name as string) || 'unnamed',
      namespace: metadata.namespace,
      labels: metadata.labels || {},
      annotations: metadata.annotations || {},
      spec,
      status,
    };

    // Parse workload resources
    if (K8S_WORKLOAD_TYPES.includes(kind)) {
      const workloadData = this.parseWorkloadResource(baseData, spec);

      evidence.push({
        id: `${baseId}-${kind.toLowerCase()}`,
        source: 'kubernetes',
        type: 'deployment',
        filePath,
        data: workloadData,
        confidence: 0.9,
        metadata: {
          timestamp: Date.now(),
          fileSize: JSON.stringify(resource).length,
        },
      });
    }

    // Parse service resources
    if (kind === 'Service') {
      const serviceData = this.parseServiceResource(baseData, spec);

      evidence.push({
        id: `${baseId}-service`,
        source: 'kubernetes',
        type: 'infrastructure',
        filePath,
        data: serviceData,
        confidence: 0.9,
        metadata: {
          timestamp: Date.now(),
          fileSize: JSON.stringify(resource).length,
        },
      });
    }

    // Parse ingress resources
    if (kind === 'Ingress') {
      const ingressData = this.parseIngressResource(baseData, spec);

      evidence.push({
        id: `${baseId}-ingress`,
        source: 'kubernetes',
        type: 'infrastructure',
        filePath,
        data: ingressData,
        confidence: 0.9,
        metadata: {
          timestamp: Date.now(),
          fileSize: JSON.stringify(resource).length,
        },
      });
    }

    // Parse config resources
    if (K8S_CONFIG_TYPES.includes(kind)) {
      evidence.push({
        id: `${baseId}-${kind.toLowerCase()}`,
        source: 'kubernetes',
        type: 'config',
        filePath,
        data: baseData,
        confidence: 0.8,
        metadata: {
          timestamp: Date.now(),
          fileSize: JSON.stringify(resource).length,
        },
      });
    }

    return evidence;
  }

  private parseWorkloadResource(baseData: K8sResourceData, spec: any): K8sWorkloadData {
    const containers = (
      spec.template?.spec?.containers ||
      spec.jobTemplate?.spec?.template?.spec?.containers ||
      []
    ).map((container: any) => ({
      name: container.name,
      image: container.image,
      ports: container.ports || [],
      env: container.env || [],
      resources: container.resources,
      readinessProbe: container.readinessProbe,
      livenessProbe: container.livenessProbe,
    }));

    return {
      ...baseData,
      containers,
      replicas: spec.replicas,
      selector: spec.selector,
      strategy: spec.strategy || spec.updateStrategy,
      volumes:
        spec.template?.spec?.volumes || spec.jobTemplate?.spec?.template?.spec?.volumes || [],
    };
  }

  private parseServiceResource(baseData: K8sResourceData, spec: any): K8sServiceData {
    return {
      ...baseData,
      type: spec.type || 'ClusterIP',
      ports: spec.ports || [],
      selector: spec.selector || {},
      clusterIP: spec.clusterIP,
      loadBalancerIP: spec.loadBalancerIP,
      externalName: spec.externalName,
    };
  }

  private parseIngressResource(baseData: K8sResourceData, spec: any): K8sIngressData {
    return {
      ...baseData,
      rules: spec.rules || [],
      tls: spec.tls || [],
    };
  }

  // ============================================================================
  // Private inference methods
  // ============================================================================

  private async inferFromWorkload(
    workloadEvidence: Evidence,
    allEvidence: Evidence[],
    context: InferenceContext
  ): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];
    const workloadData = workloadEvidence.data as unknown as K8sWorkloadData;

    // Analyze each container in the workload
    for (const container of workloadData.containers) {
      const isDatabase = this.isDatabaseContainer(container);

      if (isDatabase) {
        // Use just the workload name if it's the same as the container name
        const dbName =
          workloadData.name === container.name
            ? workloadData.name
            : `${workloadData.name}-${container.name}`;

        const dbArtifact: DatabaseArtifact = {
          id: `k8s-db-${dbName}`,
          type: 'database',
          name: dbName,
          description: `Kubernetes database: ${container.image}`,
          tags: ['kubernetes', 'database', workloadData.kind.toLowerCase()],
          metadata: {
            databaseType: this.detectDatabaseType(container.image),
            port: container.ports[0]?.containerPort,
            schemas: [],
            configuration: this.extractEnvVars(container.env),
          },
        };

        artifacts.push({
          artifact: dbArtifact,
          confidence: this.calculateConfidence([workloadEvidence], 0.9),
          provenance: this.createProvenance([workloadEvidence]),
          relationships: [],
        });
      } else {
        // Regular service
        // Use just the workload name if it's the same as the container name
        const serviceName =
          workloadData.name === container.name
            ? workloadData.name
            : `${workloadData.name}-${container.name}`;

        const serviceArtifact: ServiceArtifact = {
          id: `k8s-service-${serviceName}`,
          type: 'service',
          name: serviceName,
          description: `Kubernetes service: ${container.image}`,
          tags: ['kubernetes', 'service', workloadData.kind.toLowerCase()],
          metadata: {
            language: this.detectLanguageFromImage(container.image),
            framework: this.detectFrameworkFromImage(container.image),
            port: container.ports[0]?.containerPort,
            basePath: '/',
            environmentVariables: container.env.map(env => env.name),
            dependencies: this.extractDependencies(workloadData, allEvidence),
            endpoints: [],
            healthCheck: this.extractHealthCheck(container),
          },
        };

        artifacts.push({
          artifact: serviceArtifact,
          confidence: this.calculateConfidence([workloadEvidence], 0.85),
          provenance: this.createProvenance([workloadEvidence]),
          relationships: [],
        });
      }
    }

    return artifacts;
  }

  private async inferDeploymentArtifact(
    k8sEvidence: Evidence[],
    context: InferenceContext
  ): Promise<InferredArtifact[]> {
    // Skip creating generic namespace artifacts - they're not meaningful
    // Each actual service/deployment is already handled by inferFromWorkload
    return [];
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private isDatabaseContainer(container: { image: string }): boolean {
    const image = container.image.toLowerCase();
    return DATABASE_IMAGES.some(db => image.includes(db));
  }

  private detectDatabaseType(image: string): string {
    const imageLower = image.toLowerCase();

    if (imageLower.includes('postgres')) return 'postgresql';
    if (imageLower.includes('mysql')) return 'mysql';
    if (imageLower.includes('mongodb')) return 'mongodb';
    if (imageLower.includes('redis')) return 'redis';
    if (imageLower.includes('elasticsearch')) return 'elasticsearch';
    if (imageLower.includes('cassandra')) return 'cassandra';
    if (imageLower.includes('memcached')) return 'memcached';
    if (imageLower.includes('mariadb')) return 'mariadb';

    return undefined;
  }

  private detectLanguageFromImage(image: string): string {
    const imageLower = image.toLowerCase();

    if (imageLower.includes('node')) return 'javascript';
    if (imageLower.includes('python')) return 'python';
    if (imageLower.includes('golang') || imageLower.includes('/go:')) return 'go';
    if (imageLower.includes('openjdk') || imageLower.includes('java')) return 'java';
    if (imageLower.includes('rust')) return 'rust';
    if (imageLower.includes('ruby')) return 'ruby';
    if (imageLower.includes('php')) return 'php';
    if (imageLower.includes('dotnet') || imageLower.includes('aspnet')) return 'csharp';

    return undefined;
  }

  private detectFrameworkFromImage(image: string): string | undefined {
    const imageLower = image.toLowerCase();

    if (imageLower.includes('nginx')) return 'nginx';
    if (imageLower.includes('apache')) return 'apache';
    if (imageLower.includes('traefik')) return 'traefik';
    if (imageLower.includes('envoy')) return 'envoy';

    // Framework detection would require more sophisticated analysis
    return undefined;
  }

  private extractEnvVars(
    env: Array<{ name: string; value?: string; valueFrom?: any }>
  ): Record<string, string> {
    const envVars: Record<string, string> = {};

    for (const envVar of env) {
      if (envVar.value) {
        envVars[envVar.name] = envVar.value;
      } else if (envVar.valueFrom) {
        envVars[envVar.name] = `[from ${Object.keys(envVar.valueFrom)[0]}]`;
      }
    }

    return envVars;
  }

  private extractDependencies(workloadData: K8sWorkloadData, allEvidence: Evidence[]): any[] {
    const dependencies: any[] = [];

    // Find service dependencies based on environment variables
    for (const container of workloadData.containers) {
      for (const envVar of container.env) {
        if (
          envVar.name.includes('SERVICE_URL') ||
          envVar.name.includes('DATABASE_URL') ||
          envVar.name.includes('REDIS_URL') ||
          envVar.name.endsWith('_HOST')
        ) {
          dependencies.push({
            serviceName: envVar.name.toLowerCase().replace(/_url|_host/g, ''),
            type: envVar.name.includes('DATABASE') ? 'database' : 'service',
            required: true,
          });
        }
      }
    }

    return dependencies;
  }

  private extractHealthCheck(container: { readinessProbe?: any; livenessProbe?: any }): any {
    const probe = container.readinessProbe || container.livenessProbe;

    if (probe?.httpGet) {
      return {
        path: probe.httpGet.path || '/health',
        expectedStatusCode: 200,
        timeoutMs: (probe.timeoutSeconds || 1) * 1000,
        intervalSeconds: probe.periodSeconds || 10,
      };
    }

    return {
      path: '/health',
      expectedStatusCode: 200,
      timeoutMs: 5000,
      intervalSeconds: 30,
    };
  }

  private calculateConfidence(evidence: Evidence[], baseConfidence: number): ConfidenceScore {
    const avgEvidence = evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;
    const overall = Math.min(0.95, baseConfidence * avgEvidence);

    return {
      overall,
      breakdown: {
        evidence: avgEvidence,
        base: baseConfidence,
      },
      factors: evidence.map(e => ({
        description: `Evidence from ${e.type}`,
        weight: e.confidence,
        source: e.source,
      })),
    };
  }

  private createProvenance(evidence: Evidence[]): Provenance {
    return {
      evidence: evidence.map(e => e.id),
      plugins: ['kubernetes'],
      rules: ['k8s-resource-analysis', 'workload-inference'],
      timestamp: Date.now(),
      pipelineVersion: '1.0.0',
    };
  }
}

// Export the plugin instance
export const kubernetesPlugin = new KubernetesPlugin();
