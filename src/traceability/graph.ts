/**
 * Traceability Graph Manager
 * 
 * This module provides graph-based operations for managing traceability relationships
 * between requirements, scenarios, tests, and code artifacts. It maintains a directed
 * graph structure with optimized indexing for efficient queries and traversals.
 */

import type {
  Artifact,
  TraceabilityLink,
  TraceabilityGraph,
  TraceabilityQuery,
  QueryResult,
  ArtifactType,
  LinkType,
  GraphMetadata,
  TraceabilityConfig
} from './types.js';

/**
 * Graph traversal options
 */
export interface TraversalOptions {
  /** Maximum depth to traverse */
  maxDepth?: number;
  /** Link types to follow */
  linkTypes?: LinkType[];
  /** Direction of traversal */
  direction?: 'forward' | 'backward' | 'both';
  /** Visit each node only once */
  preventCycles?: boolean;
  /** Custom filter function */
  filter?: (artifact: Artifact) => boolean;
}

/**
 * Path between two artifacts
 */
export interface ArtifactPath {
  /** Source artifact ID */
  sourceId: string;
  /** Target artifact ID */
  targetId: string;
  /** Artifacts in the path */
  path: string[];
  /** Links in the path */
  links: string[];
  /** Total path length */
  length: number;
  /** Path weight (sum of link strengths) */
  weight: number;
}

/**
 * Graph statistics
 */
export interface GraphStatistics {
  /** Total number of artifacts */
  totalArtifacts: number;
  /** Artifacts by type */
  artifactsByType: Record<ArtifactType, number>;
  /** Total number of links */
  totalLinks: number;
  /** Links by type */
  linksByType: Record<LinkType, number>;
  /** Graph density (actual links / possible links) */
  density: number;
  /** Average degree (links per artifact) */
  averageDegree: number;
  /** Connected components count */
  connectedComponents: number;
  /** Orphaned artifacts (no links) */
  orphanedArtifacts: number;
  /** Cycles detected */
  cyclesDetected: number;
}

/**
 * Manages the traceability graph with optimized operations
 */
export class TraceabilityGraphManager {
  private graph: TraceabilityGraph;
  private config: TraceabilityConfig;

  constructor(config: TraceabilityConfig) {
    this.config = config;
    this.graph = this.createEmptyGraph();
  }

  /**
   * Creates an empty graph with proper initialization
   */
  private createEmptyGraph(): TraceabilityGraph {
    return {
      artifacts: new Map(),
      links: new Map(),
      linksBySource: new Map(),
      linksByTarget: new Map(),
      artifactsByType: new Map(),
      artifactsByFile: new Map(),
      metadata: {
        createdAt: new Date(),
        lastUpdated: new Date(),
        version: '1.0.0',
        sourcePaths: [],
        configuration: this.config
      }
    };
  }

  /**
   * Gets the current graph
   */
  getGraph(): TraceabilityGraph {
    return this.graph;
  }

  /**
   * Adds an artifact to the graph
   */
  addArtifact(artifact: Artifact): void {
    // Validate artifact
    this.validateArtifact(artifact);

    // Add to main collection
    this.graph.artifacts.set(artifact.id, artifact);

    // Update indexes
    this.updateArtifactIndexes(artifact);

    // Update metadata
    this.graph.metadata.lastUpdated = new Date();
  }

  /**
   * Updates an existing artifact
   */
  updateArtifact(artifact: Artifact): void {
    if (!this.graph.artifacts.has(artifact.id)) {
      throw new Error(`Artifact not found: ${artifact.id}`);
    }

    const oldArtifact = this.graph.artifacts.get(artifact.id)!;
    
    // Remove from old indexes
    this.removeArtifactFromIndexes(oldArtifact);
    
    // Update artifact
    this.graph.artifacts.set(artifact.id, artifact);
    
    // Add to new indexes
    this.updateArtifactIndexes(artifact);

    // Update metadata
    this.graph.metadata.lastUpdated = new Date();
  }

  /**
   * Removes an artifact and all its links
   */
  removeArtifact(artifactId: string): void {
    const artifact = this.graph.artifacts.get(artifactId);
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    // Remove all links involving this artifact
    const incomingLinks = this.graph.linksByTarget.get(artifactId) || new Set();
    const outgoingLinks = this.graph.linksBySource.get(artifactId) || new Set();
    
    [...incomingLinks, ...outgoingLinks].forEach(linkId => {
      this.removeLink(linkId);
    });

    // Remove from indexes
    this.removeArtifactFromIndexes(artifact);

    // Remove artifact
    this.graph.artifacts.delete(artifactId);

    // Update metadata
    this.graph.metadata.lastUpdated = new Date();
  }

  /**
   * Adds a link to the graph
   */
  addLink(link: TraceabilityLink): void {
    // Validate link
    this.validateLink(link);

    // Check if artifacts exist
    if (!this.graph.artifacts.has(link.sourceId)) {
      throw new Error(`Source artifact not found: ${link.sourceId}`);
    }
    if (!this.graph.artifacts.has(link.targetId)) {
      throw new Error(`Target artifact not found: ${link.targetId}`);
    }

    // Add to main collection
    this.graph.links.set(link.id, link);

    // Update indexes
    this.updateLinkIndexes(link);

    // Update metadata
    this.graph.metadata.lastUpdated = new Date();
  }

  /**
   * Updates an existing link
   */
  updateLink(link: TraceabilityLink): void {
    if (!this.graph.links.has(link.id)) {
      throw new Error(`Link not found: ${link.id}`);
    }

    const oldLink = this.graph.links.get(link.id)!;
    
    // Remove from old indexes
    this.removeLinkFromIndexes(oldLink);
    
    // Update link
    this.graph.links.set(link.id, link);
    
    // Add to new indexes
    this.updateLinkIndexes(link);

    // Update metadata
    this.graph.metadata.lastUpdated = new Date();
  }

  /**
   * Removes a link from the graph
   */
  removeLink(linkId: string): void {
    const link = this.graph.links.get(linkId);
    if (!link) {
      throw new Error(`Link not found: ${linkId}`);
    }

    // Remove from indexes
    this.removeLinkFromIndexes(link);

    // Remove link
    this.graph.links.delete(linkId);

    // Update metadata
    this.graph.metadata.lastUpdated = new Date();
  }

  /**
   * Gets artifacts linked to a given artifact
   */
  getLinkedArtifacts(
    artifactId: string,
    options: TraversalOptions = {}
  ): Artifact[] {
    const { direction = 'both', linkTypes, filter } = options;
    const linkedIds = new Set<string>();

    // Get outgoing links
    if (direction === 'forward' || direction === 'both') {
      const outgoingLinks = this.graph.linksBySource.get(artifactId) || new Set();
      for (const linkId of outgoingLinks) {
        const link = this.graph.links.get(linkId)!;
        if (!linkTypes || linkTypes.includes(link.linkType)) {
          linkedIds.add(link.targetId);
        }
      }
    }

    // Get incoming links
    if (direction === 'backward' || direction === 'both') {
      const incomingLinks = this.graph.linksByTarget.get(artifactId) || new Set();
      for (const linkId of incomingLinks) {
        const link = this.graph.links.get(linkId)!;
        if (!linkTypes || linkTypes.includes(link.linkType)) {
          linkedIds.add(link.sourceId);
        }
      }
    }

    // Get artifacts and apply filter
    const artifacts: Artifact[] = [];
    for (const id of linkedIds) {
      const artifact = this.graph.artifacts.get(id);
      if (artifact && (!filter || filter(artifact))) {
        artifacts.push(artifact);
      }
    }

    return artifacts;
  }

  /**
   * Traverses the graph from a starting artifact
   */
  traverse(
    startArtifactId: string,
    options: TraversalOptions = {}
  ): Artifact[] {
    const {
      maxDepth = Infinity,
      direction = 'forward',
      linkTypes,
      preventCycles = true,
      filter
    } = options;

    const visited = new Set<string>();
    const result: Artifact[] = [];
    const queue: { id: string; depth: number }[] = [{ id: startArtifactId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      // Skip if already visited (cycle prevention)
      if (preventCycles && visited.has(id)) {
        continue;
      }

      // Skip if max depth exceeded
      if (depth > maxDepth) {
        continue;
      }

      const artifact = this.graph.artifacts.get(id);
      if (!artifact) {
        continue;
      }

      // Mark as visited
      visited.add(id);

      // Apply filter and add to result
      if (!filter || filter(artifact)) {
        result.push(artifact);
      }

      // Add connected artifacts to queue
      const linkedArtifacts = this.getLinkedArtifacts(id, { direction, linkTypes });
      for (const linkedArtifact of linkedArtifacts) {
        if (!preventCycles || !visited.has(linkedArtifact.id)) {
          queue.push({ id: linkedArtifact.id, depth: depth + 1 });
        }
      }
    }

    return result;
  }

  /**
   * Finds all paths between two artifacts
   */
  findPaths(
    sourceId: string,
    targetId: string,
    maxDepth: number = 10
  ): ArtifactPath[] {
    const paths: ArtifactPath[] = [];
    const visited = new Set<string>();

    const dfs = (currentId: string, path: string[], links: string[], weight: number, depth: number) => {
      if (depth > maxDepth) {
        return;
      }

      if (currentId === targetId) {
        paths.push({
          sourceId,
          targetId,
          path: [...path],
          links: [...links],
          length: path.length - 1,
          weight
        });
        return;
      }

      if (visited.has(currentId)) {
        return;
      }

      visited.add(currentId);

      const outgoingLinks = this.graph.linksBySource.get(currentId) || new Set();
      for (const linkId of outgoingLinks) {
        const link = this.graph.links.get(linkId)!;
        dfs(
          link.targetId,
          [...path, link.targetId],
          [...links, linkId],
          weight + link.strength,
          depth + 1
        );
      }

      visited.delete(currentId);
    };

    dfs(sourceId, [sourceId], [], 0, 0);

    // Sort paths by weight (descending) then by length (ascending)
    return paths.sort((a, b) => {
      if (a.weight !== b.weight) {
        return b.weight - a.weight;
      }
      return a.length - b.length;
    });
  }

  /**
   * Finds orphaned artifacts (no links)
   */
  findOrphanedArtifacts(): Artifact[] {
    const orphaned: Artifact[] = [];

    for (const [artifactId, artifact] of this.graph.artifacts) {
      const hasIncoming = (this.graph.linksByTarget.get(artifactId)?.size || 0) > 0;
      const hasOutgoing = (this.graph.linksBySource.get(artifactId)?.size || 0) > 0;

      if (!hasIncoming && !hasOutgoing) {
        orphaned.push(artifact);
      }
    }

    return orphaned;
  }

  /**
   * Detects cycles in the graph
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (artifactId: string, path: string[]): boolean => {
      if (recursionStack.has(artifactId)) {
        // Found cycle
        const cycleStart = path.indexOf(artifactId);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return true;
      }

      if (visited.has(artifactId)) {
        return false;
      }

      visited.add(artifactId);
      recursionStack.add(artifactId);

      const outgoingLinks = this.graph.linksBySource.get(artifactId) || new Set();
      for (const linkId of outgoingLinks) {
        const link = this.graph.links.get(linkId)!;
        if (dfs(link.targetId, [...path, link.targetId])) {
          return true;
        }
      }

      recursionStack.delete(artifactId);
      return false;
    };

    for (const artifactId of this.graph.artifacts.keys()) {
      if (!visited.has(artifactId)) {
        dfs(artifactId, [artifactId]);
      }
    }

    return cycles;
  }

  /**
   * Queries the graph for artifacts and links
   */
  query(query: TraceabilityQuery): QueryResult {
    const startTime = performance.now();
    const {
      artifactTypes,
      linkTypes,
      searchTerms,
      pathPatterns,
      tags,
      dateRange,
      customFilters,
      sortBy,
      limit,
      offset = 0
    } = query;

    let artifacts = Array.from(this.graph.artifacts.values());
    let links = Array.from(this.graph.links.values());

    // Filter artifacts
    if (artifactTypes) {
      artifacts = artifacts.filter(a => artifactTypes.includes(a.type));
    }

    if (searchTerms) {
      const searchRegex = new RegExp(searchTerms.join('|'), 'i');
      artifacts = artifacts.filter(a => 
        searchRegex.test(a.name) || 
        searchRegex.test(a.description || '') ||
        a.tags.some(tag => searchRegex.test(tag))
      );
    }

    if (pathPatterns) {
      const pathRegex = new RegExp(pathPatterns.join('|'), 'i');
      artifacts = artifacts.filter(a => pathRegex.test(a.filePath));
    }

    if (tags) {
      artifacts = artifacts.filter(a => 
        tags.some(tag => a.tags.includes(tag))
      );
    }

    if (dateRange) {
      artifacts = artifacts.filter(a => 
        a.lastModified >= dateRange.start && 
        a.lastModified <= dateRange.end
      );
    }

    // Apply custom filters
    if (customFilters) {
      // Implementation depends on specific filter requirements
      // This is a placeholder for extensible filtering
    }

    // Filter links
    if (linkTypes) {
      links = links.filter(l => linkTypes.includes(l.linkType));
    }

    // Filter links to only include those between matching artifacts
    const artifactIds = new Set(artifacts.map(a => a.id));
    links = links.filter(l => 
      artifactIds.has(l.sourceId) && artifactIds.has(l.targetId)
    );

    // Sort results
    if (sortBy) {
      artifacts.sort((a, b) => {
        const aVal = (a as any)[sortBy.field];
        const bVal = (b as any)[sortBy.field];
        
        if (sortBy.direction === 'desc') {
          return bVal > aVal ? 1 : -1;
        } else {
          return aVal > bVal ? 1 : -1;
        }
      });
    }

    // Apply pagination
    const totalCount = artifacts.length;
    if (limit !== undefined) {
      artifacts = artifacts.slice(offset, offset + limit);
    }

    const executionTime = performance.now() - startTime;

    return {
      artifacts,
      links,
      totalCount,
      executionTime,
      metadata: {
        query,
        resultCounts: {
          artifacts: artifacts.length,
          links: links.length
        }
      }
    };
  }

  /**
   * Gets graph statistics
   */
  getStatistics(): GraphStatistics {
    const artifacts = this.graph.artifacts;
    const links = this.graph.links;

    // Count artifacts by type
    const artifactsByType: Record<ArtifactType, number> = {
      requirement: 0,
      scenario: 0,
      test: 0,
      code: 0
    };

    for (const artifact of artifacts.values()) {
      artifactsByType[artifact.type]++;
    }

    // Count links by type
    const linksByType: Record<LinkType, number> = {
      implements: 0,
      tests: 0,
      validates: 0,
      derives_from: 0,
      references: 0
    };

    for (const link of links.values()) {
      linksByType[link.linkType]++;
    }

    // Calculate density
    const totalArtifacts = artifacts.size;
    const possibleLinks = totalArtifacts * (totalArtifacts - 1);
    const density = possibleLinks > 0 ? (links.size * 2) / possibleLinks : 0;

    // Calculate average degree
    const averageDegree = totalArtifacts > 0 ? (links.size * 2) / totalArtifacts : 0;

    // Count orphaned artifacts
    const orphanedArtifacts = this.findOrphanedArtifacts().length;

    // Count cycles
    const cyclesDetected = this.detectCycles().length;

    // Count connected components (simplified implementation)
    const connectedComponents = this.countConnectedComponents();

    return {
      totalArtifacts,
      artifactsByType,
      totalLinks: links.size,
      linksByType,
      density,
      averageDegree,
      connectedComponents,
      orphanedArtifacts,
      cyclesDetected
    };
  }

  /**
   * Optimizes the graph by removing redundant links and updating indexes
   */
  optimize(): void {
    if (!this.config.features.graphOptimization) {
      return;
    }

    // Remove duplicate links
    this.removeDuplicateLinks();

    // Remove weak links below confidence threshold
    this.removeWeakLinks();

    // Rebuild indexes
    this.rebuildIndexes();

    // Update metadata
    this.graph.metadata.lastUpdated = new Date();
  }

  /**
   * Validates an artifact
   */
  private validateArtifact(artifact: Artifact): void {
    if (!artifact.id || artifact.id.trim() === '') {
      throw new Error('Artifact ID is required');
    }

    if (!artifact.name || artifact.name.trim() === '') {
      throw new Error('Artifact name is required');
    }

    if (!artifact.filePath || artifact.filePath.trim() === '') {
      throw new Error('Artifact file path is required');
    }

    if (!artifact.location || artifact.location.startLine < 1) {
      throw new Error('Valid artifact location is required');
    }
  }

  /**
   * Validates a link
   */
  private validateLink(link: TraceabilityLink): void {
    if (!link.id || link.id.trim() === '') {
      throw new Error('Link ID is required');
    }

    if (!link.sourceId || link.sourceId.trim() === '') {
      throw new Error('Link source ID is required');
    }

    if (!link.targetId || link.targetId.trim() === '') {
      throw new Error('Link target ID is required');
    }

    if (link.sourceId === link.targetId) {
      throw new Error('Link cannot connect artifact to itself');
    }

    if (link.strength < 0 || link.strength > 1) {
      throw new Error('Link strength must be between 0 and 1');
    }
  }

  /**
   * Updates artifact indexes
   */
  private updateArtifactIndexes(artifact: Artifact): void {
    // Index by type
    if (!this.graph.artifactsByType.has(artifact.type)) {
      this.graph.artifactsByType.set(artifact.type, new Set());
    }
    this.graph.artifactsByType.get(artifact.type)!.add(artifact.id);

    // Index by file
    if (!this.graph.artifactsByFile.has(artifact.filePath)) {
      this.graph.artifactsByFile.set(artifact.filePath, new Set());
    }
    this.graph.artifactsByFile.get(artifact.filePath)!.add(artifact.id);
  }

  /**
   * Removes artifact from indexes
   */
  private removeArtifactFromIndexes(artifact: Artifact): void {
    // Remove from type index
    this.graph.artifactsByType.get(artifact.type)?.delete(artifact.id);
    if (this.graph.artifactsByType.get(artifact.type)?.size === 0) {
      this.graph.artifactsByType.delete(artifact.type);
    }

    // Remove from file index
    this.graph.artifactsByFile.get(artifact.filePath)?.delete(artifact.id);
    if (this.graph.artifactsByFile.get(artifact.filePath)?.size === 0) {
      this.graph.artifactsByFile.delete(artifact.filePath);
    }
  }

  /**
   * Updates link indexes
   */
  private updateLinkIndexes(link: TraceabilityLink): void {
    // Index by source
    if (!this.graph.linksBySource.has(link.sourceId)) {
      this.graph.linksBySource.set(link.sourceId, new Set());
    }
    this.graph.linksBySource.get(link.sourceId)!.add(link.id);

    // Index by target
    if (!this.graph.linksByTarget.has(link.targetId)) {
      this.graph.linksByTarget.set(link.targetId, new Set());
    }
    this.graph.linksByTarget.get(link.targetId)!.add(link.id);
  }

  /**
   * Removes link from indexes
   */
  private removeLinkFromIndexes(link: TraceabilityLink): void {
    // Remove from source index
    this.graph.linksBySource.get(link.sourceId)?.delete(link.id);
    if (this.graph.linksBySource.get(link.sourceId)?.size === 0) {
      this.graph.linksBySource.delete(link.sourceId);
    }

    // Remove from target index
    this.graph.linksByTarget.get(link.targetId)?.delete(link.id);
    if (this.graph.linksByTarget.get(link.targetId)?.size === 0) {
      this.graph.linksByTarget.delete(link.targetId);
    }
  }

  /**
   * Removes duplicate links
   */
  private removeDuplicateLinks(): void {
    const linkMap = new Map<string, TraceabilityLink>();

    for (const link of this.graph.links.values()) {
      const key = `${link.sourceId}->${link.targetId}:${link.linkType}`;
      const existing = linkMap.get(key);

      if (!existing || link.strength > existing.strength) {
        if (existing) {
          this.removeLink(existing.id);
        }
        linkMap.set(key, link);
      } else {
        this.removeLink(link.id);
      }
    }
  }

  /**
   * Removes links below minimum confidence threshold
   */
  private removeWeakLinks(): void {
    const linksToRemove: string[] = [];

    for (const link of this.graph.links.values()) {
      if (link.isAutomatic && link.strength < this.config.minLinkConfidence) {
        linksToRemove.push(link.id);
      }
    }

    linksToRemove.forEach(linkId => this.removeLink(linkId));
  }

  /**
   * Rebuilds all indexes
   */
  private rebuildIndexes(): void {
    // Clear existing indexes
    this.graph.linksBySource.clear();
    this.graph.linksByTarget.clear();
    this.graph.artifactsByType.clear();
    this.graph.artifactsByFile.clear();

    // Rebuild artifact indexes
    for (const artifact of this.graph.artifacts.values()) {
      this.updateArtifactIndexes(artifact);
    }

    // Rebuild link indexes
    for (const link of this.graph.links.values()) {
      this.updateLinkIndexes(link);
    }
  }

  /**
   * Counts connected components in the graph
   */
  private countConnectedComponents(): number {
    const visited = new Set<string>();
    let components = 0;

    for (const artifactId of this.graph.artifacts.keys()) {
      if (!visited.has(artifactId)) {
        // Start new component
        components++;
        const stack = [artifactId];

        while (stack.length > 0) {
          const currentId = stack.pop()!;
          if (visited.has(currentId)) {
            continue;
          }

          visited.add(currentId);

          // Add all connected artifacts
          const connected = this.getLinkedArtifacts(currentId, { direction: 'both' });
          for (const connectedArtifact of connected) {
            if (!visited.has(connectedArtifact.id)) {
              stack.push(connectedArtifact.id);
            }
          }
        }
      }
    }

    return components;
  }
}

/**
 * Utility functions for graph operations
 */
export class GraphUtils {
  /**
   * Converts graph to DOT format for visualization
   */
  static toDot(graph: TraceabilityGraph): string {
    const lines = ['digraph traceability {'];
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box];');

    // Add nodes with styling based on type
    for (const artifact of graph.artifacts.values()) {
      const style = this.getNodeStyle(artifact.type);
      lines.push(`  "${artifact.id}" [label="${artifact.name}" ${style}];`);
    }

    // Add edges
    for (const link of graph.links.values()) {
      const style = this.getEdgeStyle(link.linkType);
      lines.push(`  "${link.sourceId}" -> "${link.targetId}" [label="${link.linkType}" ${style}];`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Gets DOT node style based on artifact type
   */
  private static getNodeStyle(type: ArtifactType): string {
    switch (type) {
      case 'requirement':
        return 'color=blue fillcolor=lightblue style=filled';
      case 'scenario':
        return 'color=green fillcolor=lightgreen style=filled';
      case 'test':
        return 'color=orange fillcolor=lightyellow style=filled';
      case 'code':
        return 'color=red fillcolor=lightpink style=filled';
      default:
        return 'color=gray';
    }
  }

  /**
   * Gets DOT edge style based on link type
   */
  private static getEdgeStyle(type: LinkType): string {
    switch (type) {
      case 'implements':
        return 'color=blue';
      case 'tests':
        return 'color=green style=dashed';
      case 'validates':
        return 'color=orange';
      case 'derives_from':
        return 'color=purple style=dotted';
      case 'references':
        return 'color=gray';
      default:
        return 'color=black';
    }
  }

  /**
   * Exports graph to GraphML format
   */
  static toGraphML(graph: TraceabilityGraph): string {
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
    lines.push('<graphml xmlns="http://graphml.graphdrawing.org/xmlns"');
    lines.push('         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
    lines.push('         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns');
    lines.push('         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">');
    
    // Define keys
    lines.push('  <key id="name" for="node" attr.name="name" attr.type="string"/>');
    lines.push('  <key id="type" for="node" attr.name="type" attr.type="string"/>');
    lines.push('  <key id="linkType" for="edge" attr.name="linkType" attr.type="string"/>');
    lines.push('  <key id="strength" for="edge" attr.name="strength" attr.type="double"/>');
    
    lines.push('  <graph id="traceability" edgedefault="directed">');

    // Add nodes
    for (const artifact of graph.artifacts.values()) {
      lines.push(`    <node id="${artifact.id}">`);
      lines.push(`      <data key="name">${this.escapeXml(artifact.name)}</data>`);
      lines.push(`      <data key="type">${artifact.type}</data>`);
      lines.push('    </node>');
    }

    // Add edges
    for (const link of graph.links.values()) {
      lines.push(`    <edge source="${link.sourceId}" target="${link.targetId}">`);
      lines.push(`      <data key="linkType">${link.linkType}</data>`);
      lines.push(`      <data key="strength">${link.strength}</data>`);
      lines.push('    </edge>');
    }

    lines.push('  </graph>');
    lines.push('</graphml>');
    
    return lines.join('\n');
  }

  /**
   * Escapes XML special characters
   */
  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}