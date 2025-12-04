/**
 * Storybook stories for CUE-Driven Architecture Diagram
 */

import type { Meta, StoryObj } from "@storybook/react";
import { type CueArchitectureData } from "../../types/architecture";
import { CueDrivenArchitectureDiagram } from "./CueDrivenArchitectureDiagram";

const meta: Meta<typeof CueDrivenArchitectureDiagram> = {
  title: "Components/Diagrams/CueDrivenArchitectureDiagram",
  component: CueDrivenArchitectureDiagram,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Automatically generates architecture diagrams from CUE specifications. Supports both v1 (infrastructure-focused) and v2 (app-centric) schemas.",
      },
    },
  },
  argTypes: {
    diagramType: {
      control: "select",
      options: [
        "system_overview",
        "user_journey",
        "service_topology",
        "capability_map",
        "state_diagram",
        "api_surface",
      ],
    },
    layoutType: {
      control: "select",
      options: ["layered", "force_directed", "flow"],
    },
    interactive: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof CueDrivenArchitectureDiagram>;

// Sample CUE data for v2 (app-centric) schema
const sampleV2CueData: CueArchitectureData = {
  metadata: {
    name: "Invoice Management System",
    version: "1.0.0",
    apiVersion: "arbiter.dev/v2",
    kind: "Assembly",
  },
  product: {
    name: "Invoice Manager",
    goals: ["Streamline invoice processing", "Reduce manual work"],
    constraints: ["GDPR compliance", "SOX compliance"],
  },
  ui: {
    routes: [
      {
        id: "invoices:list",
        path: "/invoices",
        capabilities: ["view_invoices", "search_invoices"],
        components: ["InvoiceList", "SearchBar"],
        name: "Invoice List",
      },
      {
        id: "invoices:detail",
        path: "/invoices/:id",
        capabilities: ["view_invoice_details", "edit_invoice"],
        components: ["InvoiceDetail", "EditForm"],
        name: "Invoice Detail",
        requiresAuth: true,
      },
      {
        id: "invoices:create",
        path: "/invoices/new",
        capabilities: ["create_invoice"],
        components: ["CreateInvoiceForm"],
        name: "Create Invoice",
        requiresAuth: true,
      },
    ],
  },
  capabilities: {
    view_invoices: {
      name: "View Invoices",
      description: "Display list of invoices",
      requirements: ["read_access", "pagination"],
    },
    edit_invoice: {
      name: "Edit Invoice",
      description: "Modify invoice details",
      requirements: ["write_access", "validation", "audit_trail"],
    },
    create_invoice: {
      name: "Create Invoice",
      description: "Create new invoice",
      requirements: ["write_access", "number_generation", "validation"],
    },
    approve_invoice: {
      name: "Approve Invoice",
      description: "Approve invoice for payment",
      requirements: ["approval_rights", "workflow_engine"],
    },
  },
  flows: [
    {
      id: "create_invoice_flow",
      name: "Create Invoice Flow",
      steps: [
        { visit: "/invoices" },
        { click: { locator: "btn:create" } },
        { visit: "/invoices/new" },
        { fill: { locator: "input:customer", value: "Acme Corp" } },
        { fill: { locator: "input:amount", value: "1000" } },
        { click: { locator: "btn:save" } },
        { expect_api: { method: "POST", path: "/api/invoices", status: 201 } },
      ],
    },
    {
      id: "approve_invoice_flow",
      name: "Approve Invoice Flow",
      steps: [
        { visit: "/invoices" },
        { click: { locator: "link:invoice-detail" } },
        { expect: { locator: "btn:approve", state: "visible" } },
        { click: { locator: "btn:approve" } },
        { expect_api: { method: "PATCH", path: "/api/invoices/:id/approve", status: 200 } },
      ],
    },
  ],
  paths: {
    "/api/invoices": {
      get: {
        response: { $ref: "InvoiceList", example: { invoices: [], total: 0 } },
      },
      post: {
        request: { $ref: "CreateInvoiceRequest" },
        response: { $ref: "Invoice" },
        status: 201,
      },
    },
    "/api/invoices/:id": {
      get: {
        response: { $ref: "Invoice" },
      },
      patch: {
        request: { $ref: "UpdateInvoiceRequest" },
        response: { $ref: "Invoice" },
      },
    },
    "/api/invoices/:id/approve": {
      patch: {
        response: { $ref: "Invoice" },
        status: 200,
      },
    },
  },
  services: {
    "invoice-api": {
      type: "internal",
      workload: "deployment",
      language: "typescript",
      ports: [{ name: "http", port: 3000, targetPort: 3000 }],
    },
    "notification-service": {
      type: "external",
      workload: "deployment",
      language: "python",
      ports: [{ name: "http", port: 8080, targetPort: 8080 }],
    },
  },
  processes: {
    invoice_state: {
      id: "invoice_state",
      initial: "draft",
      states: {
        draft: { on: { submit: "pending_approval" } },
        pending_approval: { on: { approve: "approved", reject: "rejected" } },
        approved: { on: { pay: "paid" } },
        rejected: { on: { edit: "draft" } },
        paid: {},
      },
    },
  },
  locators: {
    "btn:create": "button[data-testid='create-invoice']",
    "btn:save": "button[type='submit']",
    "btn:approve": "button[data-testid='approve-invoice']",
    "input:customer": "input[name='customer']",
    "input:amount": "input[name='amount']",
    "link:invoice-detail": "a[data-testid='invoice-link']",
  },
};

// Sample v1 (infrastructure-focused) CUE data
const sampleV1CueData: CueArchitectureData = {
  metadata: {
    name: "Microservices Platform",
    version: "1.0.0",
    apiVersion: "arbiter.dev/v1",
    kind: "Assembly",
  },
  services: {
    "user-service": {
      type: "internal",
      workload: "deployment",
      language: "golang",
      replicas: 3,
      ports: [
        { name: "http", port: 8080, targetPort: 8080 },
        { name: "grpc", port: 9090, targetPort: 9090 },
      ],
      env: {
        DATABASE_URL: "postgresql://db-service:5432/users",
        REDIS_URL: "redis://redis-service:6379",
      },
    },
    "order-service": {
      type: "internal",
      workload: "deployment",
      language: "nodejs",
      replicas: 2,
      ports: [{ name: "http", port: 3000, targetPort: 3000 }],
      env: {
        USER_SERVICE_URL: "http://user-service:8080",
        DATABASE_URL: "postgresql://db-service:5432/orders",
      },
    },
    "api-gateway": {
      type: "external",
      workload: "deployment",
      language: "nginx",
      replicas: 2,
      ports: [
        { name: "http", port: 80, targetPort: 80 },
        { name: "https", port: 443, targetPort: 443 },
      ],
      env: {
        UPSTREAM_USER_SERVICE: "user-service:8080",
        UPSTREAM_ORDER_SERVICE: "order-service:3000",
      },
    },
    "db-service": {
      type: "external",
      workload: "statefulset",
      language: "postgresql",
      replicas: 1,
      ports: [{ name: "postgres", port: 5432, targetPort: 5432 }],
    },
    "redis-service": {
      type: "external",
      workload: "deployment",
      language: "redis",
      replicas: 1,
      ports: [{ name: "redis", port: 6379, targetPort: 6379 }],
    },
  },
  deployment: {
    target: "kubernetes",
    cluster: {
      name: "production",
      provider: "eks",
      namespace: "default",
    },
  },
};

// Empty data for error state
const emptyCueData: CueArchitectureData = {};

export const SystemOverview: Story = {
  args: {
    cueData: sampleV2CueData,
    diagramType: "system_overview",
    layoutType: "layered",
    interactive: true,
  },
};

export const UserJourney: Story = {
  args: {
    cueData: sampleV2CueData,
    diagramType: "user_journey",
    layoutType: "flow",
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Focuses on user flows and interactions, showing routes, capabilities, and user journeys through the application.",
      },
    },
  },
};

export const ServiceTopology: Story = {
  args: {
    cueData: sampleV1CueData,
    diagramType: "service_topology",
    layoutType: "force_directed",
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows service interconnections and dependencies, ideal for microservices architectures.",
      },
    },
  },
};

export const CapabilityMap: Story = {
  args: {
    cueData: sampleV2CueData,
    diagramType: "capability_map",
    layoutType: "layered",
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Visualizes business capabilities and their relationships to UI components.",
      },
    },
  },
};

export const ApiSurface: Story = {
  args: {
    cueData: sampleV2CueData,
    diagramType: "api_surface",
    layoutType: "layered",
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Shows API endpoints and their relationships to services.",
      },
    },
  },
};

export const ForceDirectedLayout: Story = {
  args: {
    cueData: sampleV2CueData,
    diagramType: "system_overview",
    layoutType: "force_directed",
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Uses physics simulation to position components based on their connections.",
      },
    },
  },
};

export const NonInteractive: Story = {
  args: {
    cueData: sampleV2CueData,
    diagramType: "system_overview",
    layoutType: "layered",
    interactive: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Diagram with interactivity disabled - no hover effects or click handlers.",
      },
    },
  },
};

export const CustomTheme: Story = {
  args: {
    cueData: sampleV2CueData,
    diagramType: "system_overview",
    layoutType: "layered",
    interactive: true,
    theme: {
      layers: {
        presentation: {
          background: "#e0f2fe",
          border: "#0891b2",
          text: "#0c4a6e",
        },
        application: {
          background: "#ecfdf5",
          border: "#059669",
          text: "#064e3b",
        },
        service: {
          background: "#fef7cd",
          border: "#d97706",
          text: "#92400e",
        },
        data: {
          background: "#f5f3ff",
          border: "#7c3aed",
          text: "#5b21b6",
        },
        external: {
          background: "#fef2f2",
          border: "#dc2626",
          text: "#991b1b",
        },
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Demonstrates custom theming capabilities with different color schemes.",
      },
    },
  },
};

export const EmptyData: Story = {
  args: {
    cueData: emptyCueData,
    diagramType: "system_overview",
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the empty state when no CUE data is provided.",
      },
    },
  },
};

export const V1Schema: Story = {
  args: {
    cueData: sampleV1CueData,
    diagramType: "system_overview",
    layoutType: "layered",
    interactive: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Demonstrates parsing and visualization of v1 (infrastructure-focused) CUE schema.",
      },
    },
  },
};
