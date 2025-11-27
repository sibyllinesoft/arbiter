import { describe, expect, it } from "bun:test";
import { terraformPlugin } from "../terraform";

describe("terraform plugin", () => {
  it("supports terraform files", () => {
    expect(terraformPlugin.supports("/project/infra/main.tf")).toBe(true);
    expect(terraformPlugin.supports("/project/infra/variables.tf.json")).toBe(true);
    expect(terraformPlugin.supports("/project/readme.md")).toBe(false);
  });

  it("parses resources from terraform content", async () => {
    const tf = `
resource "aws_s3_bucket" "bucket" {
  bucket = "demo-bucket"
}
`;
    const evidence = await terraformPlugin.parse("/project/infra/main.tf", tf, {
      projectRoot: "/project",
    });
    expect(evidence.length).toBeGreaterThan(0);
  });
});
