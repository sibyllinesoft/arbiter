import { describe, expect, it } from "bun:test";
import type { Event } from "@/types/api";
import { coerceToString, getEventTargetInfo } from "./targetInfo";

const createEvent = (overrides: Partial<Event> = {}): Event => ({
  id: "evt-123",
  project_id: "proj-456",
  event_type: "entity_created",
  data: {},
  is_active: true,
  reverted_at: null,
  created_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("coerceToString", () => {
  it("returns undefined for null", () => {
    expect(coerceToString(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(coerceToString(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(coerceToString("")).toBeUndefined();
    expect(coerceToString("   ")).toBeUndefined();
  });

  it("returns trimmed string for valid strings", () => {
    expect(coerceToString("hello")).toBe("hello");
    expect(coerceToString("  hello  ")).toBe("hello");
  });

  it("returns string for numbers", () => {
    expect(coerceToString(123)).toBe("123");
    expect(coerceToString(0)).toBe("0");
  });

  it("returns string for bigint", () => {
    expect(coerceToString(BigInt(123))).toBe("123");
  });

  it("returns undefined for objects", () => {
    expect(coerceToString({})).toBeUndefined();
    expect(coerceToString([])).toBeUndefined();
  });
});

describe("getEventTargetInfo", () => {
  describe("fragment events", () => {
    it("handles fragment_created with fragment_id", () => {
      const event = createEvent({
        event_type: "fragment_created",
        data: { fragment_id: "frag-abc123def" },
      });
      const result = getEventTargetInfo(event);
      expect(result.key).toBe("fragment:frag-abc123def");
      // toShortId truncates to 8 chars with ellipsis
      expect(result.label).toBe("Fragment frag-abc…");
      expect(result.description).toBe("ID frag-abc…");
    });

    it("handles fragment_updated with path", () => {
      const event = createEvent({
        event_type: "fragment_updated",
        data: { fragment_path: "src/components/Header.tsx" },
      });
      const result = getEventTargetInfo(event);
      expect(result.key).toBe("fragment:src/components/Header.tsx");
      expect(result.label).toBe("src/components/Header.tsx");
    });

    it("handles fragment_revision_created with revision info", () => {
      const event = createEvent({
        event_type: "fragment_revision_created",
        data: {
          fragment_id: "frag-abc",
          revision_number: "3",
        },
      });
      const result = getEventTargetInfo(event);
      expect(result.description).toContain("Rev 3");
    });
  });

  describe("validation events", () => {
    it("handles validation_started with validation_id", () => {
      const event = createEvent({
        event_type: "validation_started",
        data: { validation_id: "val-xyz123" },
      });
      const result = getEventTargetInfo(event);
      expect(result.key).toBe("validation:val-xyz123");
      expect(result.label).toContain("Validation");
    });

    it("handles validation_completed with spec_hash and fragment_count", () => {
      const event = createEvent({
        event_type: "validation_completed",
        data: {
          spec_hash: "hash-abc123",
          fragment_count: "5",
        },
      });
      const result = getEventTargetInfo(event);
      expect(result.description).toContain("5 fragments");
      expect(result.description).toContain("Spec");
    });

    it("handles validation_failed", () => {
      const event = createEvent({
        event_type: "validation_failed",
        data: {},
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("Validation run");
    });
  });

  describe("version_frozen", () => {
    it("handles version_frozen with version_name", () => {
      const event = createEvent({
        event_type: "version_frozen",
        data: { version_name: "v1.2.0" },
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("v1.2.0");
      expect(result.key).toBe("version:v1.2.0");
    });

    it("handles version_frozen with version_id", () => {
      const event = createEvent({
        event_type: "version_frozen",
        data: { version_id: "ver-123" },
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toContain("Version");
      expect(result.description).toContain("ID");
    });
  });

  describe("git_push_processed", () => {
    it("handles git_push with repository and branch", () => {
      const event = createEvent({
        event_type: "git_push_processed",
        data: {
          repository: "owner/repo",
          branch: "refs/heads/main",
          provider: "github",
        },
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("Push · owner/repo");
      expect(result.description).toContain("Branch main");
      expect(result.description).toContain("via github");
    });

    it("handles git_push without repository", () => {
      const event = createEvent({
        event_type: "git_push_processed",
        data: {},
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("Git push");
    });
  });

  describe("git_merge_processed", () => {
    it("handles git_merge with branches", () => {
      const event = createEvent({
        event_type: "git_merge_processed",
        data: {
          repository: "owner/repo",
          source_branch: "feature",
          target_branch: "main",
        },
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("Merge · owner/repo");
      expect(result.description).toContain("feature → main");
    });
  });

  describe("entity events", () => {
    it("handles entity_created with type and name", () => {
      const event = createEvent({
        event_type: "entity_created",
        data: {
          entity_type: "service",
          name: "api-gateway",
          entity_id: "ent-123",
        },
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("Service: api-gateway");
      expect(result.description).toContain("ID");
    });

    it("handles entity_deleted", () => {
      const event = createEvent({
        event_type: "entity_deleted",
        data: {
          entity_type: "database",
          name: "postgres",
        },
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("Database: postgres");
    });

    it("handles entity_restored", () => {
      const event = createEvent({
        event_type: "entity_restored",
        data: {
          entity_type: "client",
        },
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("Client restored");
    });
  });

  describe("timeline events", () => {
    it("handles event_head_updated with head_event", () => {
      const event = createEvent({
        event_type: "event_head_updated",
        data: {
          head_event: {
            event_type: "fragment_created",
            data: { fragment_path: "test.ts" },
          },
        },
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("test.ts");
    });

    it("handles event_head_updated without reference", () => {
      const event = createEvent({
        event_type: "event_head_updated",
        data: {},
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("Timeline update");
      expect(result.description).toBe("Head updated");
    });

    it("handles events_reverted", () => {
      const event = createEvent({
        event_type: "events_reverted",
        data: {},
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("Timeline update");
      expect(result.description).toBe("Events reverted");
    });

    it("handles events_reapplied", () => {
      const event = createEvent({
        event_type: "events_reapplied",
        data: {},
      });
      const result = getEventTargetInfo(event);
      expect(result.label).toBe("Timeline update");
      expect(result.description).toBe("Events reapplied");
    });
  });

  describe("circular reference handling", () => {
    it("handles circular references gracefully", () => {
      const event = createEvent({ id: "evt-circular" });
      const seen = new Set<string>(["evt-circular"]);
      const result = getEventTargetInfo(event, { seen });
      expect(result.key).toBe("event:evt-circular");
    });
  });

  describe("unknown event types", () => {
    it("returns default target for unknown event type", () => {
      const event = createEvent({
        event_type: "custom_event" as any,
      });
      const result = getEventTargetInfo(event);
      expect(result.key).toBe("event-type:custom_event");
      expect(result.label).toBe("Custom Event");
    });
  });

  describe("lookupEvent integration", () => {
    it("resolves head_event_id via lookupEvent", () => {
      const referencedEvent = createEvent({
        id: "ref-evt-123",
        event_type: "fragment_created",
        data: { fragment_path: "resolved.ts" },
      });
      const event = createEvent({
        event_type: "event_head_updated",
        data: { head_event_id: "ref-evt-123" },
      });
      const lookupEvent = (id: string) => (id === "ref-evt-123" ? referencedEvent : undefined);

      const result = getEventTargetInfo(event, { lookupEvent });
      expect(result.label).toBe("resolved.ts");
    });
  });
});
