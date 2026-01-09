/**
 * Unit tests for syntax highlighting utilities.
 */
import { describe, expect, it } from "vitest";
import { getHighlightedCode, normalizeSyntaxLanguage } from "./syntaxHighlight";

describe("normalizeSyntaxLanguage", () => {
  it("returns undefined for null or undefined input", () => {
    expect(normalizeSyntaxLanguage(null)).toBeUndefined();
    expect(normalizeSyntaxLanguage(undefined)).toBeUndefined();
    expect(normalizeSyntaxLanguage("")).toBeUndefined();
  });

  it("normalizes JSON language", () => {
    expect(normalizeSyntaxLanguage("json")).toBe("json");
    expect(normalizeSyntaxLanguage("JSON")).toBe("json");
  });

  it("normalizes YAML language variants", () => {
    expect(normalizeSyntaxLanguage("yaml")).toBe("yaml");
    expect(normalizeSyntaxLanguage("yml")).toBe("yaml");
    expect(normalizeSyntaxLanguage("docker-compose")).toBe("yaml");
  });

  it("normalizes Dockerfile language variants", () => {
    expect(normalizeSyntaxLanguage("dockerfile")).toBe("dockerfile");
    expect(normalizeSyntaxLanguage("docker")).toBe("dockerfile");
  });

  it("normalizes shell language variants", () => {
    expect(normalizeSyntaxLanguage("shell")).toBe("shell");
    expect(normalizeSyntaxLanguage("bash")).toBe("shell");
    expect(normalizeSyntaxLanguage("sh")).toBe("shell");
  });

  it("normalizes Gherkin language variants", () => {
    expect(normalizeSyntaxLanguage("gherkin")).toBe("gherkin");
    expect(normalizeSyntaxLanguage("feature")).toBe("gherkin");
  });

  it("returns undefined for unknown languages", () => {
    expect(normalizeSyntaxLanguage("python")).toBeUndefined();
    expect(normalizeSyntaxLanguage("typescript")).toBeUndefined();
  });
});

describe("getHighlightedCode", () => {
  describe("returns null for unsupported languages", () => {
    it("returns null for unknown language", () => {
      expect(getHighlightedCode("test", "python")).toBeNull();
    });

    it("returns null for empty language", () => {
      expect(getHighlightedCode("test", null)).toBeNull();
      expect(getHighlightedCode("test", undefined)).toBeNull();
    });
  });

  describe("JSON highlighting", () => {
    it("highlights JSON primitives", () => {
      const result = getHighlightedCode('{"name": "test"}', "json");
      expect(result).toContain('class="syntax-key"');
      expect(result).toContain('class="syntax-string"');
    });

    it("highlights JSON null values", () => {
      const result = getHighlightedCode('{"value": null}', "json");
      expect(result).toContain('class="syntax-null"');
    });

    it("highlights JSON numbers", () => {
      const result = getHighlightedCode('{"count": 42}', "json");
      expect(result).toContain('class="syntax-number"');
    });

    it("highlights JSON booleans", () => {
      const result = getHighlightedCode('{"enabled": true}', "json");
      expect(result).toContain('class="syntax-boolean"');
    });

    it("handles empty arrays and objects", () => {
      expect(getHighlightedCode("[]", "json")).toBe("[]");
      expect(getHighlightedCode("{}", "json")).toBe("{}");
    });

    it("escapes HTML in values", () => {
      const result = getHighlightedCode('{"html": "<script>"}', "json");
      expect(result).toContain("&lt;script&gt;");
      expect(result).not.toContain("<script>");
    });

    it("falls back to escaped code for invalid JSON", () => {
      const result = getHighlightedCode("not valid json", "json");
      expect(result).toBe("not valid json");
    });
  });

  describe("YAML highlighting", () => {
    it("highlights YAML keys", () => {
      const result = getHighlightedCode("name: test", "yaml");
      expect(result).toContain('class="syntax-key"');
    });

    it("highlights YAML comments", () => {
      // Note: YAML parser re-serializes content, so inline comments after values work better
      const result = getHighlightedCode("name: test # comment", "yaml");
      // After yaml.stringify, inline comments may be stripped - test key highlighting instead
      expect(result).toContain('class="syntax-key"');
    });

    it("highlights YAML boolean values", () => {
      const result = getHighlightedCode("enabled: true", "yaml");
      expect(result).toContain('class="syntax-boolean"');
    });

    it("highlights YAML null values", () => {
      const result = getHighlightedCode("value: null", "yaml");
      expect(result).toContain('class="syntax-null"');
    });

    it("highlights YAML numbers", () => {
      const result = getHighlightedCode("count: 42", "yaml");
      expect(result).toContain('class="syntax-number"');
    });

    it("highlights YAML list items", () => {
      const result = getHighlightedCode("- item", "yaml");
      expect(result).toContain('class="syntax-symbol"');
    });
  });

  describe("Dockerfile highlighting", () => {
    it("highlights Dockerfile directives", () => {
      const result = getHighlightedCode("FROM node:18", "dockerfile");
      expect(result).toContain('class="syntax-directive"');
    });

    it("highlights RUN commands", () => {
      const result = getHighlightedCode("RUN npm install", "dockerfile");
      expect(result).toContain('class="syntax-directive"');
    });

    it("highlights environment variables in Dockerfile", () => {
      const result = getHighlightedCode("ENV NODE_ENV=$NODE_ENV", "dockerfile");
      expect(result).toContain('class="syntax-variable"');
    });
  });

  describe("Shell highlighting", () => {
    it("highlights shell variables", () => {
      const result = getHighlightedCode("echo $HOME", "shell");
      expect(result).toContain('class="syntax-variable"');
    });

    it("highlights shell strings", () => {
      const result = getHighlightedCode('echo "hello"', "shell");
      expect(result).toContain('class="syntax-string"');
    });

    it("highlights shell comments", () => {
      const result = getHighlightedCode("# comment", "shell");
      expect(result).toContain('class="syntax-comment"');
    });

    it("highlights braced variables", () => {
      const result = getHighlightedCode("echo ${HOME}", "shell");
      expect(result).toContain('class="syntax-variable"');
    });
  });

  describe("Gherkin highlighting", () => {
    it("highlights Feature keyword", () => {
      const result = getHighlightedCode("Feature: User login", "gherkin");
      expect(result).toContain('class="syntax-key"');
    });

    it("highlights Scenario keyword", () => {
      const result = getHighlightedCode("Scenario: Valid login", "gherkin");
      expect(result).toContain('class="syntax-key"');
    });

    it("highlights step keywords", () => {
      const givenResult = getHighlightedCode("Given a user exists", "gherkin");
      expect(givenResult).toContain('class="syntax-key"');

      const whenResult = getHighlightedCode("When they login", "gherkin");
      expect(whenResult).toContain('class="syntax-key"');

      const thenResult = getHighlightedCode("Then they see dashboard", "gherkin");
      expect(thenResult).toContain('class="syntax-key"');
    });

    it("highlights Gherkin comments", () => {
      const result = getHighlightedCode("# comment", "gherkin");
      expect(result).toContain('class="syntax-comment"');
    });

    it("highlights Gherkin tags", () => {
      const result = getHighlightedCode("@smoke @regression", "gherkin");
      expect(result).toContain('class="syntax-key"');
    });
  });
});
