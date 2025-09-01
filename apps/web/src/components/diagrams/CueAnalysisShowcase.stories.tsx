/**
 * CUE Analysis Visualization Stories
 * Interactive demonstrations of how CUE code analysis results are converted to visual diagrams
 * This showcases the core capabilities of the Arbiter system
 */

import type { Meta, StoryObj } from '@storybook/react';
import { SplitViewShowcase } from './SplitViewShowcase';
import { DataViewer } from './DataViewer';
import { MermaidRenderer } from './MermaidRenderer';
import { NetworkDiagram } from './NetworkDiagram';

const meta = {
  title: 'Arbiter/CUE Analysis Visualization',
  component: SplitViewShowcase,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Interactive demonstrations showing how CUE code analysis results are transformed into various diagram types. This is the core visualization capability of Arbiter.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SplitViewShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// CUE CODE EXAMPLES WITH ANALYSIS RESULTS
// ============================================================================

const ecommerceSpecCue = `// E-commerce Platform Specification in CUE
package ecommerce

// Product catalog capability
productCatalog: {
    capability: "C1"
    name: "Product Management"
    
    // Product data structure
    product: {
        id: string & =~"^[A-Z0-9]{8}$"
        name: string
        price: number & >0
        category: "electronics" | "clothing" | "books" | "home"
        inStock: bool
        tags: [...string]
        created: string // ISO 8601
    }
    
    // API endpoints
    endpoints: {
        "/products": {
            GET: {
                description: "List all products"
                parameters: {
                    limit?: int & >0 & <=100
                    offset?: int & >=0
                    category?: product.category
                }
                response: {
                    products: [...product]
                    total: int
                    hasMore: bool
                }
            }
            POST: {
                description: "Create new product"
                body: product & {id?: _} // ID generated server-side
                response: product
            }
        }
        "/products/{id}": {
            GET: {
                description: "Get product by ID"
                response: product
            }
            PUT: {
                description: "Update product"
                body: product
                response: product
            }
            DELETE: {
                description: "Delete product"
                response: {success: bool}
            }
        }
    }
}

// User authentication capability  
userAuth: {
    capability: "C2"
    name: "User Authentication"
    
    user: {
        id: string & =~"^[A-Z0-9]{8}$"
        email: string & =~"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
        hashedPassword: string
        role: "customer" | "admin" | "manager"
        createdAt: string
        lastLogin?: string
    }
    
    session: {
        token: string
        userId: user.id
        expiresAt: string
        permissions: [...string]
    }
    
    endpoints: {
        "/auth/register": {
            POST: {
                description: "Register new user"
                body: {
                    email: user.email
                    password: string & len >8
                    role: user.role & "customer" // default to customer
                }
                response: user & {hashedPassword?: _}
            }
        }
        "/auth/login": {
            POST: {
                description: "Authenticate user"
                body: {
                    email: user.email
                    password: string
                }
                response: {
                    user: user & {hashedPassword?: _}
                    session: session
                }
            }
        }
        "/auth/logout": {
            POST: {
                description: "End user session"
                headers: {
                    Authorization: "Bearer " + session.token
                }
                response: {success: bool}
            }
        }
    }
}

// Order processing capability
orderProcessing: {
    capability: "C3"  
    name: "Order Management"
    dependsOn: [productCatalog.capability, userAuth.capability]
    
    order: {
        id: string & =~"^ORDER-[A-Z0-9]{8}$"
        userId: userAuth.user.id
        items: [...{
            productId: productCatalog.product.id
            quantity: int & >0
            priceAtOrder: number & >0
        }]
        status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled"
        totalAmount: number & >0
        createdAt: string
        shippingAddress: {
            street: string
            city: string
            state: string
            zipCode: string & =~"^[0-9]{5}(-[0-9]{4})?$"
            country: "US" | "CA" | "MX"
        }
    }
    
    endpoints: {
        "/orders": {
            GET: {
                description: "List user orders"
                headers: {
                    Authorization: "Bearer " + userAuth.session.token
                }
                parameters: {
                    status?: order.status
                    limit?: int & >0 & <=50
                }
                response: {
                    orders: [...order]
                    total: int
                }
            }
            POST: {
                description: "Create new order"
                headers: {
                    Authorization: "Bearer " + userAuth.session.token
                }
                body: order & {
                    id?: _
                    createdAt?: _
                    status?: "pending"
                }
                response: order
            }
        }
        "/orders/{id}": {
            GET: {
                description: "Get order details"
                headers: {
                    Authorization: "Bearer " + userAuth.session.token
                }
                response: order
            }
            PATCH: {
                description: "Update order status"
                headers: {
                    Authorization: "Bearer " + userAuth.session.token
                }
                body: {
                    status: order.status
                }
                response: order
            }
        }
    }
}

// System-wide validation rules
validation: {
    // All endpoints must have descriptions
    for capability in [productCatalog, userAuth, orderProcessing] {
        for path, methods in capability.endpoints {
            for method, spec in methods {
                spec.description: string & len >0
            }
        }
    }
    
    // All capabilities must have unique IDs
    capabilities: [productCatalog.capability, userAuth.capability, orderProcessing.capability]
    if len(list.Unique(capabilities)) != len(capabilities) {
        error: "Duplicate capability IDs found"
    }
}`;

// This represents the analysis result that would come from the CUE analyzer
const cueAnalysisResult = `{
  "value": {
    "productCatalog": {
      "capability": "C1",
      "name": "Product Management",
      "endpoints": {
        "/products": {
          "GET": {"description": "List all products"},
          "POST": {"description": "Create new product"}
        },
        "/products/{id}": {
          "GET": {"description": "Get product by ID"},
          "PUT": {"description": "Update product"},
          "DELETE": {"description": "Delete product"}
        }
      }
    },
    "userAuth": {
      "capability": "C2", 
      "name": "User Authentication",
      "endpoints": {
        "/auth/register": {
          "POST": {"description": "Register new user"}
        },
        "/auth/login": {
          "POST": {"description": "Authenticate user"}
        },
        "/auth/logout": {
          "POST": {"description": "End user session"}
        }
      }
    },
    "orderProcessing": {
      "capability": "C3",
      "name": "Order Management", 
      "dependsOn": ["C1", "C2"],
      "endpoints": {
        "/orders": {
          "GET": {"description": "List user orders"},
          "POST": {"description": "Create new order"}
        },
        "/orders/{id}": {
          "GET": {"description": "Get order details"},
          "PATCH": {"description": "Update order status"}
        }
      }
    }
  },
  "graph": {
    "nodes": [
      {
        "id": "C1",
        "label": "Product Management\\n(C1)",
        "type": "capability",
        "endpoints": 5,
        "color": "#0ea5e9"
      },
      {
        "id": "C2", 
        "label": "User Authentication\\n(C2)",
        "type": "capability",
        "endpoints": 3,
        "color": "#8b5cf6"
      },
      {
        "id": "C3",
        "label": "Order Management\\n(C3)", 
        "type": "capability",
        "endpoints": 4,
        "color": "#f59e0b"
      },
      {
        "id": "GET_/products",
        "label": "GET /products",
        "type": "endpoint",
        "capability": "C1",
        "color": "#10b981"
      },
      {
        "id": "POST_/products", 
        "label": "POST /products",
        "type": "endpoint",
        "capability": "C1",
        "color": "#10b981"
      },
      {
        "id": "GET_/auth/login",
        "label": "GET /auth/login",
        "type": "endpoint", 
        "capability": "C2",
        "color": "#10b981"
      },
      {
        "id": "POST_/orders",
        "label": "POST /orders",
        "type": "endpoint",
        "capability": "C3", 
        "color": "#10b981"
      }
    ],
    "edges": [
      {
        "from": "C3",
        "to": "C1",
        "label": "depends on",
        "type": "dependency",
        "color": "#6b7280"
      },
      {
        "from": "C3", 
        "to": "C2",
        "label": "depends on",
        "type": "dependency",
        "color": "#6b7280"
      },
      {
        "from": "C1",
        "to": "GET_/products",
        "label": "provides",
        "type": "provides",
        "color": "#10b981"
      },
      {
        "from": "C1",
        "to": "POST_/products",
        "label": "provides", 
        "type": "provides",
        "color": "#10b981"
      },
      {
        "from": "C2",
        "to": "GET_/auth/login",
        "label": "provides",
        "type": "provides",
        "color": "#10b981"
      },
      {
        "from": "C3",
        "to": "POST_/orders",
        "label": "provides",
        "type": "provides", 
        "color": "#10b981"
      }
    ]
  }
}`;

// Mermaid diagram generated from CUE analysis
const capabilityMermaid = `graph TD
    %% Capabilities
    C1[🛍️ Product Management<br/>C1<br/>5 endpoints]
    C2[🔐 User Authentication<br/>C2<br/>3 endpoints]  
    C3[📦 Order Management<br/>C3<br/>4 endpoints]
    
    %% Key endpoints
    EP1[GET /products<br/>List products]
    EP2[POST /products<br/>Create product]
    EP3[POST /auth/login<br/>User login]
    EP4[POST /auth/register<br/>User signup]
    EP5[POST /orders<br/>Create order]
    EP6[GET /orders<br/>List orders]
    
    %% Dependencies
    C3 --> C1
    C3 --> C2
    
    %% Endpoint relationships
    C1 --> EP1
    C1 --> EP2
    C2 --> EP3
    C2 --> EP4
    C3 --> EP5
    C3 --> EP6
    
    %% Styling
    classDef capability fill:#e0f2fe,stroke:#0284c7,stroke-width:3px
    classDef endpoint fill:#f0fdf4,stroke:#059669,stroke-width:2px
    classDef dependency stroke:#dc2626,stroke-width:3px,stroke-dasharray:5,5
    
    class C1,C2,C3 capability
    class EP1,EP2,EP3,EP4,EP5,EP6 endpoint`;

// State machine for order processing (derived from CUE spec)
const orderStateMermaid = `stateDiagram-v2
    [*] --> Draft
    
    Draft --> Validating : submit_order
    Validating --> Pending : validation_passed
    Validating --> Draft : validation_failed
    
    Pending --> Confirmed : payment_processed
    Pending --> Cancelled : payment_failed
    
    Confirmed --> Processing : start_fulfillment
    Processing --> Shipped : items_dispatched
    Processing --> Cancelled : fulfillment_failed
    
    Shipped --> InTransit : tracking_active
    InTransit --> Delivered : delivery_confirmed
    InTransit --> Returned : return_requested
    
    Delivered --> [*]
    Cancelled --> [*] 
    Returned --> Refunded
    Refunded --> [*]
    
    %% State annotations
    Validating : Validate inventory\\nCheck payment method\\nVerify shipping address
    Processing : Reserve inventory\\nPrepare shipment\\nGenerate tracking
    InTransit : Package in transit\\nTracking updates sent\\nDelivery estimated
    
    %% Styling
    classDef startState fill:#e1f5fe,stroke:#01579b
    classDef activeState fill:#f3e5f5,stroke:#4a148c  
    classDef endState fill:#e8f5e8,stroke:#1b5e20
    classDef errorState fill:#ffebee,stroke:#d32f2f
    
    class Pending,Confirmed,Processing,Shipped,InTransit activeState
    class Delivered,Refunded endState
    class Cancelled,Returned errorState`;

// Network nodes for architecture diagram
const architectureNodes = [
  { id: 'client', label: 'Web Client\n(React)', group: 'client', color: '#3b82f6', shape: 'box' },
  { id: 'gateway', label: 'API Gateway\n:8080', group: 'gateway', color: '#1e40af', shape: 'box' },
  { id: 'products', label: 'Product Service\n:8081', group: 'service', color: '#0ea5e9', shape: 'ellipse' },
  { id: 'auth', label: 'Auth Service\n:8082', group: 'service', color: '#8b5cf6', shape: 'ellipse' },
  { id: 'orders', label: 'Order Service\n:8083', group: 'service', color: '#f59e0b', shape: 'ellipse' },
  { id: 'products_db', label: 'Products DB\n(PostgreSQL)', group: 'database', color: '#374151', shape: 'database' },
  { id: 'users_db', label: 'Users DB\n(PostgreSQL)', group: 'database', color: '#374151', shape: 'database' },
  { id: 'orders_db', label: 'Orders DB\n(PostgreSQL)', group: 'database', color: '#374151', shape: 'database' },
  { id: 'redis', label: 'Redis Cache\n(Sessions)', group: 'cache', color: '#dc2626', shape: 'diamond' },
];

const architectureEdges = [
  { from: 'client', to: 'gateway', label: 'HTTPS API', color: '#3b82f6' },
  { from: 'gateway', to: 'products', label: '/products/*', color: '#0ea5e9' },
  { from: 'gateway', to: 'auth', label: '/auth/*', color: '#8b5cf6' },
  { from: 'gateway', to: 'orders', label: '/orders/*', color: '#f59e0b' },
  
  { from: 'products', to: 'products_db', label: 'queries', color: '#4b5563', dashes: true },
  { from: 'auth', to: 'users_db', label: 'queries', color: '#4b5563', dashes: true },
  { from: 'auth', to: 'redis', label: 'sessions', color: '#dc2626', dashes: true },
  { from: 'orders', to: 'orders_db', label: 'queries', color: '#4b5563', dashes: true },
  
  { from: 'orders', to: 'products', label: 'inventory check', color: '#0ea5e9' },
  { from: 'orders', to: 'auth', label: 'validate token', color: '#8b5cf6' },
];

// ============================================================================
// STORY DEFINITIONS
// ============================================================================

export const CueSpecAnalysis: Story = {
  args: {
    title: "CUE Specification Analysis",
    description: "Real-time analysis of a CUE specification showing how structured code becomes structured data. This demonstrates Arbiter's core CUE parsing and analysis capabilities.",
    dataPanelTitle: "E-commerce Platform Spec (CUE)",
    diagramPanelTitle: "Analyzed Structure (JSON)",
    dataPanel: (
      <DataViewer
        data={ecommerceSpecCue}
        language="typescript"
        title="ecommerce-platform.cue"
      />
    ),
    diagramPanel: (
      <DataViewer
        data={cueAnalysisResult}
        language="json"
        title="analysis-result.json"
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how CUE code is parsed and analyzed by Arbiter. The left panel shows the original CUE specification, while the right panel shows the structured analysis result that feeds into diagram generation.',
      },
    },
  },
};

export const CapabilityDiagram: Story = {
  args: {
    title: "Capability Dependency Visualization",
    description: "Interactive diagram showing how capabilities, endpoints, and dependencies are visualized from CUE analysis. Generated automatically from the specification structure.",
    dataPanelTitle: "Analysis Result (JSON)",
    diagramPanelTitle: "Capability Dependency Graph",
    dataPanel: (
      <DataViewer
        data={cueAnalysisResult}
        language="json"
        title="analysis-result.json"
      />
    ),
    diagramPanel: (
      <MermaidRenderer 
        chart={capabilityMermaid}
        title="Auto-generated Capability Map"
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates how CUE analysis results are transformed into visual capability maps. The diagram is generated automatically from the dependency structure defined in the CUE specification.',
      },
    },
  },
};

export const OrderStateMachine: Story = {
  args: {
    title: "Order Processing State Machine",
    description: "State machine diagram derived from CUE order specification. Shows how business logic constraints become visual workflow diagrams.",
    dataPanelTitle: "CUE Order Specification",
    diagramPanelTitle: "Order Processing States",
    dataPanel: (
      <DataViewer
        data={ecommerceSpecCue.substring(
          ecommerceSpecCue.indexOf('// Order processing capability'),
          ecommerceSpecCue.indexOf('// System-wide validation rules')
        )}
        language="typescript"
        title="order-processing.cue"
      />
    ),
    diagramPanel: (
      <MermaidRenderer 
        chart={orderStateMermaid}
        title="Order Lifecycle State Machine"
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how state machines can be derived from CUE business logic specifications. The states and transitions are inferred from the order status constraints and business rules.',
      },
    },
  },
};

export const SystemArchitecture: Story = {
  args: {
    title: "System Architecture Network",
    description: "Network diagram showing the complete system architecture derived from CUE capability analysis. Visualizes services, databases, and inter-service communication patterns.",
    dataPanelTitle: "Capability Dependencies",
    diagramPanelTitle: "System Architecture",
    dataPanel: (
      <DataViewer
        data={JSON.stringify({
          capabilities: ["C1", "C2", "C3"],
          services: {
            "C1": "Product Service :8081",
            "C2": "Auth Service :8082", 
            "C3": "Order Service :8083"
          },
          dependencies: {
            "C3": ["C1", "C2"]
          },
          endpoints: {
            "C1": ["/products", "/products/{id}"],
            "C2": ["/auth/login", "/auth/register", "/auth/logout"],
            "C3": ["/orders", "/orders/{id}"]
          }
        }, null, 2)}
        language="json"
        title="architecture-analysis.json"
      />
    ),
    diagramPanel: (
      <NetworkDiagram 
        nodes={architectureNodes}
        edges={architectureEdges}
        title="E-commerce Platform Architecture"
        options={{
          groups: {
            client: { color: { background: '#dbeafe', border: '#3b82f6' } },
            gateway: { color: { background: '#dbeafe', border: '#1e40af' } },
            service: { color: { background: '#f0f9ff', border: '#0284c7' } },
            database: { color: { background: '#f9fafb', border: '#374151' } },
            cache: { color: { background: '#fef2f2', border: '#dc2626' } },
          },
          layout: {
            hierarchical: {
              enabled: true,
              levelSeparation: 120,
              nodeSpacing: 100,
              treeSpacing: 120,
              blockShifting: true,
              edgeMinimization: true,
              parentCentralization: true,
              direction: 'UD',
              sortMethod: 'directed',
            },
          },
        }}
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Complete system architecture visualization derived from CUE capability analysis. Shows how service boundaries, data dependencies, and communication patterns emerge from the specification structure.',
      },
    },
  },
};

// Interactive demo that lets users modify CUE and see diagram updates
const interactiveCue = `// Modify this CUE spec to see diagram updates
package demo

// Simple capability example
userManagement: {
    capability: "UM1"
    name: "User Management"
    
    user: {
        id: string
        email: string
        role: "admin" | "user"
    }
    
    endpoints: {
        "/users": {
            GET: {description: "List users"}
            POST: {description: "Create user"}
        }
    }
}

// Try adding a dependency:
// dependsOn: ["SOME_OTHER_CAP"]

// Try adding more endpoints:
// "/users/{id}": {
//     GET: {description: "Get user"}
//     PUT: {description: "Update user"}  
//     DELETE: {description: "Delete user"}
// }`;

const interactiveResult = `{
  "message": "Edit the CUE specification on the left to see real-time analysis updates here",
  "capabilities": ["UM1"],
  "endpoints": 2,
  "dependencies": 0,
  "hint": "Try adding more capabilities, endpoints, or dependencies to see the diagram change"
}`;

export const InteractiveDemo: Story = {
  args: {
    title: "Interactive CUE Analysis Demo",
    description: "Try editing the CUE specification to see how changes affect the analysis results and diagrams in real-time. This demonstrates Arbiter's live analysis capabilities.",
    dataPanelTitle: "Editable CUE Specification",
    diagramPanelTitle: "Live Analysis Results",
    dataPanel: (
      <DataViewer
        data={interactiveCue}
        language="typescript"
        title="demo.cue"
      />
    ),
    diagramPanel: (
      <DataViewer
        data={interactiveResult}
        language="json"
        title="live-analysis.json"
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive demonstration showing how Arbiter analyzes CUE specifications in real-time. In the actual application, editing the CUE code would trigger immediate reanalysis and diagram updates.',
      },
    },
  },
};

// Real-world example with complex dependencies
const realWorldCue = `// Real-world banking platform specification
package banking

// Account management
accounts: {
    capability: "ACC1"
    name: "Account Management"
    
    account: {
        id: string & =~"^ACC-[0-9]{8}$"
        userId: string
        type: "checking" | "savings" | "credit"
        balance: number
        currency: "USD" | "EUR" | "GBP"
        status: "active" | "frozen" | "closed"
    }
    
    endpoints: {
        "/accounts": {
            GET: {description: "List user accounts"}
            POST: {description: "Create account"}
        }
        "/accounts/{id}/balance": {
            GET: {description: "Get account balance"}
        }
    }
}

// Transaction processing  
transactions: {
    capability: "TXN1"
    name: "Transaction Processing"
    dependsOn: [accounts.capability, notifications.capability]
    
    transaction: {
        id: string & =~"^TXN-[0-9]{10}$"
        fromAccount: accounts.account.id
        toAccount: accounts.account.id
        amount: number & >0
        type: "transfer" | "deposit" | "withdrawal"
        status: "pending" | "completed" | "failed"
    }
    
    endpoints: {
        "/transactions": {
            POST: {description: "Create transaction"}
        }
        "/transactions/{id}": {
            GET: {description: "Get transaction status"}
        }
    }
}

// Notification system
notifications: {
    capability: "NOT1"
    name: "Notification Service"
    
    notification: {
        id: string
        userId: string
        type: "transaction" | "security" | "marketing"
        channel: "email" | "sms" | "push"
        content: string
        sent: bool
    }
    
    endpoints: {
        "/notifications": {
            GET: {description: "List notifications"}
            POST: {description: "Send notification"}
        }
    }
}`;

const realWorldMermaid = `graph TD
    %% Banking capabilities
    ACC[🏦 Account Management<br/>ACC1<br/>3 endpoints]
    TXN[💸 Transaction Processing<br/>TXN1<br/>2 endpoints] 
    NOT[🔔 Notification Service<br/>NOT1<br/>2 endpoints]
    
    %% Key endpoints
    EP1[GET /accounts<br/>List accounts]
    EP2[POST /accounts<br/>Create account]
    EP3[GET /accounts/{id}/balance<br/>Check balance]
    EP4[POST /transactions<br/>Process payment]
    EP5[GET /transactions/{id}<br/>Transaction status]
    EP6[POST /notifications<br/>Send alert]
    
    %% Complex dependencies
    TXN --> ACC
    TXN --> NOT
    
    %% Endpoint relationships  
    ACC --> EP1
    ACC --> EP2
    ACC --> EP3
    TXN --> EP4
    TXN --> EP5
    NOT --> EP6
    
    %% Cross-service interactions
    EP4 -.-> EP3
    EP4 -.-> EP6
    EP5 -.-> EP6
    
    %% Styling
    classDef capability fill:#e8f5e8,stroke:#1b5e20,stroke-width:3px
    classDef endpoint fill:#f0fdf4,stroke:#059669,stroke-width:2px
    classDef interaction stroke:#f59e0b,stroke-width:2px,stroke-dasharray:3,3
    
    class ACC,TXN,NOT capability
    class EP1,EP2,EP3,EP4,EP5,EP6 endpoint`;

export const RealWorldBankingPlatform: Story = {
  args: {
    title: "Real-World Banking Platform",
    description: "Complex real-world example showing a banking platform with multiple interconnected capabilities, cross-service dependencies, and sophisticated business logic constraints.",
    dataPanelTitle: "Banking Platform Spec (CUE)",
    diagramPanelTitle: "Complex Capability Network",
    dataPanel: (
      <DataViewer
        data={realWorldCue}
        language="typescript"
        title="banking-platform.cue"
      />
    ),
    diagramPanel: (
      <MermaidRenderer 
        chart={realWorldMermaid}
        title="Banking Platform Architecture"
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Real-world complexity demonstration showing how Arbiter handles sophisticated business domains with multiple capabilities, complex dependencies, and cross-service interactions.',
      },
    },
  },
};