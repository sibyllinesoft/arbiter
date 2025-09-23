import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs-extra';
import type {
  ActionType,
  ArtifactLogEntry as ArtifactLog,
  ArtifactType,
  InferredArtifact,
  Spec,
} from './types';

export interface IPersister {
  createSpec(scope: string, config_files?: string[]): Promise<string>;
  logArtifact(specId: string, artifact: InferredArtifact, action: ActionType): Promise<void>;
  logRemove(specId: string, lastAddLog: ArtifactLog): Promise<void>;
  getLatestSpecId(scope: string): Promise<string | null>;
  deriveCurrentArtifacts(scope: string): Promise<InferredArtifact[]>;
  getAllLogsForSpecChain(specId: string): Promise<ArtifactLog[]>;
  isArtifactCurrent(scope: string, artifact: InferredArtifact): Promise<boolean>;
  getLastAddLog(scope: string, artifactName: string): Promise<ArtifactLog | null>;
}

export class SimpleJsonPersister implements IPersister {
  private specsPath: string;
  private logsPath: string;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.specsPath = path.join(projectRoot, 'importer-specs.json');
    this.logsPath = path.join(projectRoot, 'importer-artifact-log.json');
    this.ensureFiles();
  }

  private ensureFiles() {
    if (!fs.existsSync(this.specsPath)) {
      fs.writeJsonSync(this.specsPath, { scopes: {} }, { spaces: 2 });
    }
    if (!fs.existsSync(this.logsPath)) {
      fs.writeJsonSync(this.logsPath, [], { spaces: 2 });
    }
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private computeArtifactHash(artifact: InferredArtifact): string {
    const data = JSON.stringify({
      name: artifact.artifact.name,
      type: artifact.artifact.type,
      metadata: artifact.artifact.metadata,
      provenance: artifact.provenance,
      confidence: artifact.confidence,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async createSpec(scope: string, config_files?: string[]): Promise<string> {
    const specs = fs.readJsonSync(this.specsPath);
    const scopeSpecs = specs.scopes[scope] || [];
    const previousRevision =
      scopeSpecs.length > 0 ? scopeSpecs[scopeSpecs.length - 1].revision_id : null;
    const newRevision = this.generateId();
    const newSpec: Spec = {
      revision_id: newRevision,
      parent_revision_id: previousRevision,
      scope,
      timestamp: Date.now(),
      config_files,
    };
    scopeSpecs.push(newSpec);
    specs.scopes[scope] = scopeSpecs;
    fs.writeJsonSync(this.specsPath, specs, { spaces: 2 });
    return newRevision;
  }

  async getLatestSpecId(scope: string): Promise<string | null> {
    const specs = fs.readJsonSync(this.specsPath);
    const scopeSpecs = specs.scopes[scope] || [];
    return scopeSpecs.length > 0 ? scopeSpecs[scopeSpecs.length - 1].revision_id : null;
  }

  async logArtifact(specId: string, artifact: InferredArtifact, action: ActionType): Promise<void> {
    const logs = fs.readJsonSync(this.logsPath);
    const logEntry: ArtifactLog = {
      id: this.generateId(),
      spec_id: specId,
      artifact_name: artifact.artifact.name,
      artifact_type: artifact.artifact.type,
      artifact_hash: this.computeArtifactHash(artifact),
      artifact_data: JSON.stringify(artifact.artifact),
      provenance_data: JSON.stringify(artifact.provenance),
      confidence_data: JSON.stringify(artifact.confidence),
      action,
      timestamp: Date.now(),
    };
    logs.push(logEntry);
    fs.writeJsonSync(this.logsPath, logs, { spaces: 2 });
  }

  async logRemove(specId: string, lastAddLog: ArtifactLog): Promise<void> {
    const logs = fs.readJsonSync(this.logsPath);
    const logEntry: ArtifactLog = {
      id: this.generateId(),
      spec_id: specId,
      artifact_name: lastAddLog.artifact_name,
      artifact_type: lastAddLog.artifact_type,
      artifact_hash: lastAddLog.artifact_hash,
      artifact_data: lastAddLog.artifact_data,
      provenance_data: lastAddLog.provenance_data,
      confidence_data: lastAddLog.confidence_data,
      action: 'remove',
      timestamp: Date.now(),
    };
    logs.push(logEntry);
    fs.writeJsonSync(this.logsPath, logs, { spaces: 2 });
  }

  async isArtifactCurrent(scope: string, artifact: InferredArtifact): Promise<boolean> {
    const latestSpecId = await this.getLatestSpecId(scope);
    if (!latestSpecId) return false;
    const allLogs = await this.getAllLogsForSpecChain(latestSpecId);
    const nameLogs = allLogs
      .filter(l => l.artifact_name === artifact.artifact.name && l.action === 'add')
      .sort((a, b) => b.timestamp - a.timestamp);
    if (nameLogs.length === 0) return false;
    const lastHash = nameLogs[0].artifact_hash;
    return lastHash === this.computeArtifactHash(artifact);
  }

  async getLastAddLog(scope: string, artifactName: string): Promise<ArtifactLog | null> {
    const latestSpecId = await this.getLatestSpecId(scope);
    if (!latestSpecId) return null;
    const allLogs = await this.getAllLogsForSpecChain(latestSpecId);
    const nameLogs = allLogs
      .filter(l => l.artifact_name === artifactName && l.action === 'add')
      .sort((a, b) => b.timestamp - a.timestamp);
    return nameLogs.length > 0 ? nameLogs[0] : null;
  }

  async getAllLogsForSpecChain(specId: string): Promise<ArtifactLog[]> {
    const specs = fs.readJsonSync(this.specsPath);
    const logs = fs.readJsonSync(this.logsPath);
    const specChain: string[] = [];
    let current: string | null = specId;
    while (current) {
      specChain.push(current);
      const spec = this.findSpecById(specs, current);
      current = spec?.parent_revision_id || null;
    }
    return logs.filter((log: ArtifactLog) => specChain.includes(log.spec_id));
  }

  private findSpecById(specsData: any, revisionId: string): Spec | null {
    for (const scopeSpecs of Object.values(specsData.scopes)) {
      for (const spec of scopeSpecs as Spec[]) {
        if (spec.revision_id === revisionId) return spec;
      }
    }
    return null;
  }

  async deriveCurrentArtifacts(scope: string): Promise<InferredArtifact[]> {
    const latestSpecId = await this.getLatestSpecId(scope);
    if (!latestSpecId) return [];
    const allLogs = await this.getAllLogsForSpecChain(latestSpecId);
    const artifactsByName: Map<string, InferredArtifact> = new Map();
    const processedHashes = new Set<string>();

    const logsByName = new Map<string, ArtifactLog[]>();
    for (const log of allLogs) {
      if (!logsByName.has(log.artifact_name)) {
        logsByName.set(log.artifact_name, []);
      }
      logsByName.get(log.artifact_name)!.push(log);
    }

    for (const [name, nameLogs] of logsByName) {
      const adds = nameLogs
        .filter(log => log.action === 'add')
        .sort((a, b) => b.timestamp - a.timestamp);
      if (adds.length === 0) continue;
      const lastAdd = adds[0];
      if (processedHashes.has(lastAdd.artifact_hash)) continue;

      const artifactData = JSON.parse(lastAdd.artifact_data);
      const provenanceData = lastAdd.provenance_data
        ? JSON.parse(lastAdd.provenance_data)
        : {
            evidence: [],
            plugins: [],
            rules: [],
            timestamp: lastAdd.timestamp,
            pipelineVersion: '1.0',
          };
      const confidenceData = lastAdd.confidence_data
        ? JSON.parse(lastAdd.confidence_data)
        : { overall: 1, breakdown: {}, factors: [] };
      const reconstructed: InferredArtifact = {
        artifact: artifactData,
        confidence: confidenceData,
        provenance: provenanceData,
        relationships: [],
      };
      artifactsByName.set(name, reconstructed);
      processedHashes.add(lastAdd.artifact_hash);
    }

    return Array.from(artifactsByName.values());
  }
}
