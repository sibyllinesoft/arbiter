import type { SRFFragmentEntry } from "../types.js";

/**
 * Handles composition of CUE specifications from SRF fragments
 */
export class SpecificationComposer {
  /**
   * Integrate a new fragment into an existing specification
   */
  async integrateFragment(
    currentSpec: string,
    fragmentContent: string,
    fragmentEntry: SRFFragmentEntry,
  ): Promise<string> {
    try {
      // Parse the fragment to extract CUE specification parts
      const parsedFragment = await this.parseFragment(fragmentContent);

      // Parse the current specification
      const currentParsed = currentSpec
        ? await this.parseSpec(currentSpec)
        : this.createEmptySpec();

      // Merge the fragment into the current specification
      const mergedSpec = this.mergeSpecs(currentParsed, parsedFragment, fragmentEntry);

      // Generate the final CUE specification
      return this.generateCueSpec(mergedSpec);
    } catch (error) {
      throw new Error(
        `Fragment integration failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Parse an SRF fragment to extract CUE specification components
   */
  async parseFragment(fragmentContent: string): Promise<ParsedSpec> {
    const spec: ParsedSpec = {
      metadata: {},
      types: {},
      fields: {},
      constraints: {},
      features: {},
      integrationPoints: {},
      dependencies: [],
    };

    try {
      // Extract metadata from YAML blocks
      spec.metadata = this.extractMetadata(fragmentContent);

      // Extract technical specifications
      const techSpecs = this.extractTechnicalSpecifications(fragmentContent);
      spec.types = techSpecs.types;
      spec.fields = techSpecs.fields;
      spec.constraints = techSpecs.constraints;

      // Extract feature definitions
      spec.features = this.extractFeatures(fragmentContent);

      // Extract integration points
      spec.integrationPoints = this.extractIntegrationPoints(fragmentContent);

      // Extract dependencies
      spec.dependencies = this.extractDependencies(fragmentContent);
    } catch (error) {
      throw new Error(
        `Fragment parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return spec;
  }

  /**
   * Parse an existing CUE specification
   */
  async parseSpec(specContent: string): Promise<ParsedSpec> {
    const spec: ParsedSpec = {
      metadata: {},
      types: {},
      fields: {},
      constraints: {},
      features: {},
      integrationPoints: {},
      dependencies: [],
    };

    try {
      // Extract metadata from CUE comments and metadata fields
      spec.metadata = this.extractCueMetadata(specContent);

      // Extract type definitions
      spec.types = this.extractCueTypes(specContent);

      // Extract field definitions
      spec.fields = this.extractCueFields(specContent);

      // Extract constraints
      spec.constraints = this.extractCueConstraints(specContent);

      // Extract feature blocks
      spec.features = this.extractCueFeatures(specContent);

      // Extract integration points
      spec.integrationPoints = this.extractCueIntegrationPoints(specContent);
    } catch (error) {
      throw new Error(
        `Spec parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return spec;
  }

  /**
   * Create an empty specification structure
   */
  private createEmptySpec(): ParsedSpec {
    return {
      metadata: {},
      types: {},
      fields: {},
      constraints: {},
      features: {},
      integrationPoints: {},
      dependencies: [],
    };
  }

  /**
   * Merge two parsed specifications
   */
  private mergeSpecs(
    currentSpec: ParsedSpec,
    fragmentSpec: ParsedSpec,
    fragmentEntry: SRFFragmentEntry,
  ): ParsedSpec {
    const merged: ParsedSpec = {
      metadata: { ...currentSpec.metadata, ...fragmentSpec.metadata },
      types: { ...currentSpec.types, ...fragmentSpec.types },
      fields: { ...currentSpec.fields, ...fragmentSpec.fields },
      constraints: { ...currentSpec.constraints, ...fragmentSpec.constraints },
      features: { ...currentSpec.features, ...fragmentSpec.features },
      integrationPoints: { ...currentSpec.integrationPoints, ...fragmentSpec.integrationPoints },
      dependencies: [...currentSpec.dependencies, ...fragmentSpec.dependencies],
    };

    // Add fragment metadata to the merged spec
    merged.metadata[`fragment_${fragmentEntry.id}`] = {
      filename: fragmentEntry.filename,
      imported_at: fragmentEntry.imported_at,
      description: fragmentEntry.description,
      version: fragmentEntry.version,
    };

    return merged;
  }

  /**
   * Generate CUE specification from parsed components
   */
  private generateCueSpec(spec: ParsedSpec): string {
    const parts: string[] = [];

    // Generate header
    parts.push(this.generateHeader(spec.metadata));

    // Generate type definitions
    if (Object.keys(spec.types).length > 0) {
      parts.push(this.generateTypeDefinitions(spec.types));
    }

    // Generate feature specifications
    if (Object.keys(spec.features).length > 0) {
      parts.push(this.generateFeatureSpecifications(spec.features));
    }

    // Generate integration points
    if (Object.keys(spec.integrationPoints).length > 0) {
      parts.push(this.generateIntegrationPoints(spec.integrationPoints));
    }

    // Generate constraints
    if (Object.keys(spec.constraints).length > 0) {
      parts.push(this.generateConstraints(spec.constraints));
    }

    // Generate footer with project export
    parts.push(this.generateFooter(spec));

    return parts.join("\n\n");
  }

  /**
   * Extract metadata from SRF YAML blocks
   */
  private extractMetadata(content: string): Record<string, any> {
    const metadata: Record<string, any> = {};

    try {
      // Find first YAML block (metadata)
      const yamlMatch = content.match(/```yaml([\\s\\S]*?)```/);
      if (!yamlMatch) return metadata;

      const yamlContent = yamlMatch[1];
      const lines = yamlContent.split("\\n");

      let currentKey = "";
      let currentValue: any = {};
      const indentLevel = 0;

      for (const line of lines) {
        if (line.trim() === "") continue;

        const trimmed = line.trim();
        const indent = line.length - line.trimStart().length;

        if (trimmed.endsWith(":") && !trimmed.includes('"')) {
          // This is a key
          const key = trimmed.slice(0, -1);

          if (indent === 0) {
            currentKey = key;
            currentValue = {};
            metadata[key] = currentValue;
          } else {
            // Nested key
            const nestedKey = key;
            if (typeof currentValue === "object") {
              currentValue[nestedKey] = "";
            }
          }
        } else if (trimmed.includes(":")) {
          // This is a key-value pair
          const [key, ...valueParts] = trimmed.split(":");
          const value = valueParts
            .join(":")
            .trim()
            .replace(/^["']|["']$/g, "");

          if (indent === 0) {
            metadata[key.trim()] = value;
          } else if (typeof currentValue === "object") {
            currentValue[key.trim()] = value;
          }
        }
      }
    } catch (error) {
      // If YAML parsing fails, continue with empty metadata
    }

    return metadata;
  }

  /**
   * Extract technical specifications from SRF content
   */
  private extractTechnicalSpecifications(content: string): {
    types: Record<string, any>;
    fields: Record<string, any>;
    constraints: Record<string, any>;
  } {
    const result = {
      types: {} as Record<string, any>,
      fields: {} as Record<string, any>,
      constraints: {} as Record<string, any>,
    };

    try {
      // Find Technical Specifications section
      const techMatch = content.match(/## Technical Specifications([\\s\\S]*?)(?=##|$)/);
      if (!techMatch) return result;

      const techContent = techMatch[1];

      // Extract API definitions
      const apiMatches = techContent.match(/### API[\\s\\S]*?(?=###|$)/g) || [];
      for (const apiMatch of apiMatches) {
        const apiTypes = this.parseAPIDefinitions(apiMatch);
        Object.assign(result.types, apiTypes);
      }

      // Extract data models
      const dataMatches = techContent.match(/### Data[\\s\\S]*?(?=###|$)/g) || [];
      for (const dataMatch of dataMatches) {
        const dataTypes = this.parseDataModels(dataMatch);
        Object.assign(result.types, dataTypes);
      }

      // Extract constraints from validation sections
      const validationMatches = techContent.match(/### Validation[\\s\\S]*?(?=###|$)/g) || [];
      for (const validationMatch of validationMatches) {
        const constraints = this.parseValidationRules(validationMatch);
        Object.assign(result.constraints, constraints);
      }
    } catch (error) {
      // Continue with empty result if parsing fails
    }

    return result;
  }

  /**
   * Extract features from SRF content
   */
  private extractFeatures(content: string): Record<string, any> {
    const features: Record<string, any> = {};

    try {
      // Find Requirements Analysis section
      const reqMatch = content.match(/## Requirements Analysis([\\s\\S]*?)(?=##|$)/);
      if (!reqMatch) return features;

      const reqContent = reqMatch[1];

      // Extract feature requirements
      const featureMatches = reqContent.match(/### Feature[\\s\\S]*?(?=###|$)/g) || [];
      for (let i = 0; i < featureMatches.length; i++) {
        const featureContent = featureMatches[i];
        const featureName = `feature_${i + 1}`;

        features[featureName] = {
          description: this.extractFeatureDescription(featureContent),
          requirements: this.extractFeatureRequirements(featureContent),
          priority: this.extractFeaturePriority(featureContent),
        };
      }

      // Extract general requirements as features
      const requirements = this.extractRequirementsList(reqContent);
      for (let i = 0; i < requirements.length; i++) {
        const req = requirements[i];
        const reqName = `requirement_${i + 1}`;

        features[reqName] = {
          description: req.text,
          priority: req.priority,
          type: "requirement",
        };
      }
    } catch (error) {
      // Continue with empty features if parsing fails
    }

    return features;
  }

  /**
   * Extract integration points from SRF content
   */
  private extractIntegrationPoints(content: string): Record<string, any> {
    const integrationPoints: Record<string, any> = {};

    try {
      // Find Integration Points section
      const integrationMatch = content.match(/## Integration Points([\\s\\S]*?)(?=##|$)/);
      if (!integrationMatch) return integrationPoints;

      const integrationContent = integrationMatch[1];

      // Extract external services
      const serviceMatches =
        integrationContent.match(/### External Service[\\s\\S]*?(?=###|$)/g) || [];
      for (let i = 0; i < serviceMatches.length; i++) {
        const serviceContent = serviceMatches[i];
        const serviceName = `external_service_${i + 1}`;

        integrationPoints[serviceName] = {
          type: "external_service",
          description: this.extractServiceDescription(serviceContent),
          protocol: this.extractServiceProtocol(serviceContent),
          authentication: this.extractServiceAuth(serviceContent),
        };
      }

      // Extract database connections
      const dbMatches = integrationContent.match(/### Database[\\s\\S]*?(?=###|$)/g) || [];
      for (let i = 0; i < dbMatches.length; i++) {
        const dbContent = dbMatches[i];
        const dbName = `database_${i + 1}`;

        integrationPoints[dbName] = {
          type: "database",
          description: this.extractDatabaseDescription(dbContent),
          engine: this.extractDatabaseEngine(dbContent),
          schema: this.extractDatabaseSchema(dbContent),
        };
      }
    } catch (error) {
      // Continue with empty integration points if parsing fails
    }

    return integrationPoints;
  }

  /**
   * Extract dependencies from SRF content
   */
  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];

    try {
      // Look for dependency mentions in technical specs
      const depMatches =
        content.match(/(?:depends?\\s+on|requires?|uses?)\\s+([a-zA-Z0-9_\\-\\/]+)/gi) || [];

      for (const match of depMatches) {
        const dep = match.replace(/(?:depends?\\s+on|requires?|uses?)\\s+/i, "").trim();
        if (dep && !dependencies.includes(dep)) {
          dependencies.push(dep);
        }
      }
    } catch (error) {
      // Continue with empty dependencies if parsing fails
    }

    return dependencies;
  }

  // CUE parsing methods
  private extractCueMetadata(content: string): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Extract from comments
    const commentMatches = content.match(/\/\/\s*(.+)/g) || [];
    for (const comment of commentMatches) {
      const text = comment.replace(/\/\/\s*/, "");
      if (text.includes(":")) {
        const [key, ...valueParts] = text.split(":");
        metadata[key.trim().toLowerCase()] = valueParts.join(":").trim();
      }
    }

    return metadata;
  }

  private extractCueTypes(content: string): Record<string, any> {
    const types: Record<string, any> = {};

    // Extract type definitions (e.g., #TypeName: {...})
    const typeMatches =
      content.match(/#([a-zA-Z][a-zA-Z0-9_]*):([\\s\\S]*?)(?=\\n#|\\n\\n|$)/g) || [];

    for (const match of typeMatches) {
      const nameMatch = match.match(/#([a-zA-Z][a-zA-Z0-9_]*):/);
      if (nameMatch) {
        const typeName = nameMatch[1];
        const definition = match.substring(match.indexOf(":") + 1).trim();

        types[typeName] = {
          definition,
          kind: this.inferCueTypeKind(definition),
        };
      }
    }

    return types;
  }

  private extractCueFields(content: string): Record<string, any> {
    const fields: Record<string, any> = {};

    // Extract field definitions
    const fieldMatches = content.match(/^\\s*([a-zA-Z_][a-zA-Z0-9_]*):\\s*(.+)$/gm) || [];

    for (const match of fieldMatches) {
      const [, fieldName, fieldType] = match.match(/^\\s*([a-zA-Z_][a-zA-Z0-9_]*):\\s*(.+)$/) || [];
      if (fieldName && fieldType) {
        fields[fieldName] = {
          type: fieldType.trim(),
          constraints: this.extractFieldConstraints(fieldType),
        };
      }
    }

    return fields;
  }

  private extractCueConstraints(content: string): Record<string, any> {
    const constraints: Record<string, any> = {};

    // Extract constraint expressions
    const constraintMatches =
      content.match(/([a-zA-Z_][a-zA-Z0-9_]*):\\s*([^\\n]*[<>=&|!][^\\n]*)/g) || [];

    for (const match of constraintMatches) {
      const [, fieldName, constraint] = match.match(/([a-zA-Z_][a-zA-Z0-9_]*):\\s*(.+)/) || [];
      if (fieldName && constraint) {
        if (!constraints[fieldName]) {
          constraints[fieldName] = [];
        }
        constraints[fieldName].push(constraint.trim());
      }
    }

    return constraints;
  }

  private extractCueFeatures(content: string): Record<string, any> {
    const features: Record<string, any> = {};

    // Extract feature blocks (comments + definitions)
    const featureMatches =
      content.match(/\/\/\s*Feature[\s\S]*?\n([a-zA-Z_][a-zA-Z0-9_]*):\s*\{[\s\S]*?\}/g) || [];

    for (const match of featureMatches) {
      const nameMatch = match.match(/\n([a-zA-Z_][a-zA-Z0-9_]*):\s*\{/);
      if (nameMatch) {
        const featureName = nameMatch[1];
        features[featureName] = {
          definition: match,
          type: "cue_feature",
        };
      }
    }

    return features;
  }

  private extractCueIntegrationPoints(content: string): Record<string, any> {
    const integrationPoints: Record<string, any> = {};

    // Extract integration-related definitions
    const integrationMatches =
      content.match(
        /(?:external|integration|service|database)_[a-zA-Z0-9_]*:\\s*\\{[\\s\\S]*?\\}/gi,
      ) || [];

    for (let i = 0; i < integrationMatches.length; i++) {
      const match = integrationMatches[i];
      const nameMatch = match.match(/([a-zA-Z0-9_]+):/);
      if (nameMatch) {
        integrationPoints[nameMatch[1]] = {
          definition: match,
          type: "cue_integration",
        };
      }
    }

    return integrationPoints;
  }

  // Helper methods for generating CUE specification
  private generateHeader(metadata: Record<string, any>): string {
    const packageName = (metadata.project_name || "main").replace(/[^a-zA-Z0-9]/g, "");

    return `// Generated CUE specification
// Composed at: ${new Date().toISOString()}
// Project: ${metadata.project_name || "Unknown"}
// Description: ${metadata.description || "No description"}

package ${packageName}`;
  }

  private generateTypeDefinitions(types: Record<string, any>): string {
    const typeDefs: string[] = ["// Type definitions"];

    for (const [typeName, typeInfo] of Object.entries(types)) {
      if (typeof typeInfo === "object" && typeInfo.definition) {
        typeDefs.push(`#${typeName}: ${typeInfo.definition}`);
      }
    }

    return typeDefs.join("\\n");
  }

  private generateFeatureSpecifications(features: Record<string, any>): string {
    const featureSpecs: string[] = ["// Feature specifications"];

    for (const [featureName, featureInfo] of Object.entries(features)) {
      if (typeof featureInfo === "object") {
        featureSpecs.push(`// Feature: ${featureName}`);
        featureSpecs.push(`// Description: ${featureInfo.description || "No description"}`);
        featureSpecs.push(`${featureName}: {`);
        featureSpecs.push(`\\tdescription: "${featureInfo.description || ""}"`);
        featureSpecs.push(`\\tpriority: "${featureInfo.priority || "normal"}"`);
        featureSpecs.push(`\\ttype: "${featureInfo.type || "feature"}"`);
        featureSpecs.push("}");
      }
    }

    return featureSpecs.join("\\n");
  }

  private generateIntegrationPoints(integrationPoints: Record<string, any>): string {
    const integrationSpecs: string[] = ["// Integration points"];

    for (const [pointName, pointInfo] of Object.entries(integrationPoints)) {
      if (typeof pointInfo === "object") {
        integrationSpecs.push(`${pointName}: {`);
        integrationSpecs.push(`\\ttype: "${pointInfo.type || "integration"}"`);
        integrationSpecs.push(`\\tdescription: "${pointInfo.description || ""}"`);

        if (pointInfo.protocol) {
          integrationSpecs.push(`\\tprotocol: "${pointInfo.protocol}"`);
        }
        if (pointInfo.authentication) {
          integrationSpecs.push(`\\tauthentication: "${pointInfo.authentication}"`);
        }

        integrationSpecs.push("}");
      }
    }

    return integrationSpecs.join("\\n");
  }

  private generateConstraints(constraints: Record<string, any>): string {
    const constraintSpecs: string[] = ["// Validation constraints"];

    for (const [constraintName, constraintList] of Object.entries(constraints)) {
      if (Array.isArray(constraintList)) {
        for (const constraint of constraintList) {
          constraintSpecs.push(`${constraintName}: ${constraint}`);
        }
      }
    }

    return constraintSpecs.join("\\n");
  }

  private generateFooter(spec: ParsedSpec): string {
    return `// Project export
project: {
\\tmetadata: ${JSON.stringify(spec.metadata, null, "\\t").replace(/"/g, '\\"')}
\\tfeatures: {${Object.keys(spec.features)
      .map((f) => `\\n\\t\\t${f}: ${f}`)
      .join("")}
\\t}
\\tintegrations: {${Object.keys(spec.integrationPoints)
      .map((i) => `\\n\\t\\t${i}: ${i}`)
      .join("")}
\\t}
}`;
  }

  // Additional helper methods
  private parseAPIDefinitions(content: string): Record<string, any> {
    // Basic API parsing - could be enhanced
    return {};
  }

  private parseDataModels(content: string): Record<string, any> {
    // Basic data model parsing - could be enhanced
    return {};
  }

  private parseValidationRules(content: string): Record<string, any> {
    // Basic validation rule parsing - could be enhanced
    return {};
  }

  private extractFeatureDescription(content: string): string {
    const lines = content
      .split("\\n")
      .map((l) => l.trim())
      .filter((l) => l);
    return lines.length > 1 ? lines[1] : "";
  }

  private extractFeatureRequirements(content: string): string[] {
    const reqMatches = content.match(/[-*]\\s+(.+)/g) || [];
    return reqMatches.map((match) => match.replace(/[-*]\\s+/, ""));
  }

  private extractFeaturePriority(content: string): string {
    const priorityMatch = content.match(/(must|should|could|won't)/i);
    return priorityMatch ? priorityMatch[1].toLowerCase() : "normal";
  }

  private extractRequirementsList(content: string): Array<{ text: string; priority: string }> {
    const requirements: Array<{ text: string; priority: string }> = [];
    const reqMatches = content.match(/[-*]\\s+(.+)/g) || [];

    for (const match of reqMatches) {
      const text = match.replace(/[-*]\\s+/, "");
      const priority = this.extractFeaturePriority(text);
      requirements.push({ text, priority });
    }

    return requirements;
  }

  private extractServiceDescription(content: string): string {
    return this.extractFeatureDescription(content);
  }

  private extractServiceProtocol(content: string): string {
    const protocolMatch =
      content.match(/protocol:\\s*([^\\n]+)/i) ||
      content.match(/(HTTP|REST|GraphQL|gRPC|WebSocket)/i);
    return protocolMatch ? protocolMatch[1] : "HTTP";
  }

  private extractServiceAuth(content: string): string {
    const authMatch =
      content.match(/auth(?:entication)?:\\s*([^\\n]+)/i) ||
      content.match(/(OAuth|JWT|API Key|Basic)/i);
    return authMatch ? authMatch[1] : "none";
  }

  private extractDatabaseDescription(content: string): string {
    return this.extractFeatureDescription(content);
  }

  private extractDatabaseEngine(content: string): string {
    const engineMatch =
      content.match(/engine:\\s*([^\\n]+)/i) || content.match(/(PostgreSQL|MySQL|MongoDB|Redis)/i);
    return engineMatch ? engineMatch[1] : "unknown";
  }

  private extractDatabaseSchema(content: string): string {
    const schemaMatch = content.match(/schema:\\s*([^\\n]+)/i);
    return schemaMatch ? schemaMatch[1] : "";
  }

  private inferCueTypeKind(definition: string): string {
    if (definition.includes("{")) return "object";
    if (definition.includes("[")) return "array";
    if (definition.includes("|")) return "union";
    return "primitive";
  }

  private extractFieldConstraints(fieldType: string): string[] {
    const constraints: string[] = [];
    const constraintMatches = fieldType.match(/[<>=&|!][^\\s]+/g) || [];

    for (const match of constraintMatches) {
      constraints.push(match);
    }

    return constraints;
  }
}

// Helper interface for parsed specifications
interface ParsedSpec {
  metadata: Record<string, any>;
  types: Record<string, any>;
  fields: Record<string, any>;
  constraints: Record<string, any>;
  features: Record<string, any>;
  integrationPoints: Record<string, any>;
  dependencies: string[];
}
