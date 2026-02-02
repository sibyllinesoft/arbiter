import "@arbiter/specification";

declare module "@arbiter/specification" {
  interface UIRoute {
    name?: string | null;
    summary?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
  }

  interface ProductSpec {
    description?: string | null;
  }

  interface ServiceConfig {
    description?: string | null;
    technology?: string | null;
  }

  interface FlowSpec {
    description?: string | null;
  }

  interface OpsAutomationSpec {
    tools?: string[];
    notes?: string[];
  }

  interface OpsSpec {
    automation?: OpsAutomationSpec;
  }
}
