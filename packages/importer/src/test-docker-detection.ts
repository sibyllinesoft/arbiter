#!/usr/bin/env bun

import { ArtifactClassifier } from "./detection/classifier";
import { DockerPlugin } from "./plugins/docker";
import type { InferenceContext, ParseContext, ProjectMetadata } from "./types";

// Test with the actual Arbiter project's docker-compose.yml content
async function testDockerDetection() {
  const plugin = new DockerPlugin();

  const dockerComposeContent = `version: '3.8'

services:
  # Spec Workbench Backend
  spec-workbench:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '5050:5050'
    environment:
      - NODE_ENV=development
      - PORT=5050
      - NATS_URL=nats://nats:4222
      - DATABASE_PATH=/app/data/spec_workbench.db
    volumes:
      - ./data:/app/data
      - ./examples:/app/examples:ro
    depends_on:
      - nats
    networks:
      - spec-workbench

  # NATS Server for external agent communication
  nats:
    image: nats:2.10-alpine
    ports:
      - '4222:4222' # Client connections
      - '6222:6222' # Cluster connections
      - '8222:8222' # HTTP monitoring
    command:
      - '--cluster_name=spec-workbench'
      - '--cluster=nats://0.0.0.0:6222'
      - '--http_port=8222'
      - '--port=4222'
      - '--server_name=nats-server'
    networks:
      - spec-workbench

  # NATS Monitoring Dashboard (optional)
  nats-surveyor:
    image: natsio/nats-surveyor:latest
    ports:
      - '7777:7777'
    command:
      - '-s'
      - 'http://nats:8222'
      - '-p'
      - '7777'
    depends_on:
      - nats
    networks:
      - spec-workbench

  # Example External Agent
  example-agent:
    build:
      context: .
      dockerfile: Dockerfile.agent
    environment:
      - NATS_URL=nats://nats:4222
      - AGENT_NAME=ExampleAnalysisAgent
    depends_on:
      - nats
      - spec-workbench
    networks:
      - spec-workbench
    profiles:
      - agents # Only start with --profile agents

networks:
  spec-workbench:
    driver: bridge

volumes:
  spec-data:
    driver: local`;

  const testFile = "/tmp/test-docker-compose.yml";
  const parseContext: ParseContext = {
    projectRoot: "/home/nathan/Projects/arbiter",
    fileIndex: {
      root: "/home/nathan/Projects/arbiter",
      files: new Map(),
      directories: new Map(),
      timestamp: Date.now(),
    },
    options: {
      deepAnalysis: false,
      targetLanguages: [],
      maxFileSize: 10 * 1024 * 1024,
      includeBinaries: false,
      patterns: { include: ["**/*"], exclude: [] },
    },
    cache: new Map(),
  };
  const evidence = await plugin.parse(testFile, dockerComposeContent, parseContext);

  console.log("Docker Compose Service Detection Results:");
  console.log("=========================================\n");

  for (const ev of evidence) {
    if (ev.type === "config" && (ev.data as any).configType === "compose-service") {
      const data = ev.data as any;
      console.log(`Service: ${data.serviceName}`);
      console.log(`  Image: ${data.image || "(built locally)"}`);
      console.log(`  Build: ${data.build ? JSON.stringify(data.build) : "N/A"}`);
      console.log(
        `  Ports: ${data.ports && data.ports.length > 0 ? data.ports.map((p: any) => `${p.host}:${p.container}`).join(", ") : "none"}`,
      );
      console.log(`  Depends On: ${data.dependsOn ? data.dependsOn.join(", ") : "none"}`);
      console.log(
        `  Environment: ${data.environment ? data.environment.slice(0, 3).join(", ") + (data.environment.length > 3 ? "..." : "") : "none"}`,
      );
      console.log("");
    }
  }

  // Now test inference to see what artifacts are created
  const projectMetadata: ProjectMetadata = {
    name: "arbiter",
    root: "/home/nathan/Projects/arbiter",
    languages: ["typescript", "javascript"],
    frameworks: ["react", "express"],
    fileCount: 1000,
    totalSize: 5000000,
  };
  const inferenceContext: InferenceContext = {
    projectRoot: "/home/nathan/Projects/arbiter",
    fileIndex: parseContext.fileIndex,
    allEvidence: evidence,
    directoryContexts: new Map(),
    classifier: new ArtifactClassifier(),
    options: {
      minConfidence: 0.3,
      inferRelationships: true,
      maxDependencyDepth: 5,
      useHeuristics: true,
    },
    cache: new Map(),
    projectMetadata,
  };
  const inferred = await plugin.infer(evidence, inferenceContext);

  console.log("\nInferred Artifacts:");
  console.log("===================\n");

  for (const artifact of inferred) {
    console.log(`Artifact ID: ${artifact.artifact.id}`);
    console.log(`  Type: ${artifact.artifact.type}`);
    console.log(`  Name: ${artifact.artifact.name}`);
    console.log(`  Description: ${artifact.artifact.description}`);
    const metadata = artifact.artifact.metadata as any;
    if (metadata.containerImage) {
      console.log(`  Container Image: ${metadata.containerImage}`);
    }
    if (metadata.buildContext) {
      console.log(`  Build Context: ${metadata.buildContext}`);
    }
    if (metadata.port) {
      console.log(`  Port: ${metadata.port}`);
    }
    console.log(`  Language: ${metadata.language}`);
    console.log("");
  }
}

testDockerDetection().catch(console.error);
