import { describe, expect, it } from "bun:test";
import { KubernetesPlugin } from "../kubernetes";

const plugin = new KubernetesPlugin();
const projectRoot = "/work";

const manifest = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: demo
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: api
          image: ghcr.io/acme/api:latest
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
`;

describe("KubernetesPlugin", () => {
  it("supports yaml under kubernetes/manifests paths", () => {
    expect(plugin.supports("/work/kubernetes/deploy.yaml")).toBe(true);
    expect(plugin.supports("/work/other/file.yaml")).toBe(false);
  });

  it("parses manifests into infrastructure evidence and infers artifacts", async () => {
    const evidence = await plugin.parse("/work/kubernetes/deploy.yaml", manifest, { projectRoot });
    expect(evidence.length).toBe(2);
    const artifacts = await plugin.infer(evidence, { projectRoot } as any);
    expect(artifacts.length).toBe(2);
    const deployment = artifacts.find((a) => a.artifact.metadata.kind === "Deployment");
    expect(deployment?.artifact.description).toContain("Deploys api");
    const service = artifacts.find((a) => a.artifact.metadata.kind === "Service");
    expect(service?.artifact.description).toContain("ports 80");
  });
});
