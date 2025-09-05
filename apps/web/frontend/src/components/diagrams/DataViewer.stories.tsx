import type { Meta, StoryObj } from '@storybook/react';
import { DataViewer } from './DataViewer';
import { 
  basicRequirementsCue,
  assemblySpecCue,
  complexTypescriptProjectCue,
  sampleResolvedData 
} from '../../test/cue-samples';

const meta: Meta<typeof DataViewer> = {
  title: 'Components/CUE Visualization/DataViewer',
  component: DataViewer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# Data Viewer

A versatile component for displaying structured data with syntax highlighting and copy functionality.

## Supported Languages

- **CUE**: Full CUE syntax highlighting for specifications and configurations
- **JSON**: Pretty-printed JSON with proper formatting
- **YAML**: YAML syntax highlighting for configurations
- **JavaScript**: JavaScript code display
- **TypeScript**: TypeScript code display with type annotations

## Features

- **Syntax Highlighting**: Language-specific highlighting using CSS classes
- **Copy to Clipboard**: One-click copying of the displayed content
- **Responsive Design**: Adapts to container size with scrolling
- **Multiple Formats**: Accepts both string and object data
- **Customizable**: Configurable title, styling, and controls

## Use Cases

1. **Configuration Display**: Show CUE, JSON, or YAML configurations
2. **Code Examples**: Display code snippets in documentation
3. **API Responses**: Format and display API response data
4. **File Content**: Show the contents of various file types
5. **Data Export**: Present data in a copyable format

The component automatically handles object serialization to JSON and provides appropriate syntax highlighting based on the specified language.
        `,
      },
    },
  },
  argTypes: {
    language: {
      control: 'select',
      options: ['cue', 'json', 'yaml', 'javascript', 'typescript'],
      description: 'Programming language for syntax highlighting',
    },
    data: {
      control: 'object',
      description: 'Data to display (string or object)',
    },
    title: {
      control: 'text',
      description: 'Optional title for the viewer',
    },
    showCopyButton: {
      control: 'boolean',
      description: 'Show copy to clipboard button',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DataViewer>;

/**
 * CUE requirements specification with proper syntax highlighting.
 * Shows how the DataViewer handles complex CUE files.
 */
export const CueRequirements: Story = {
  args: {
    title: 'CUE Requirements Specification',
    data: basicRequirementsCue,
    language: 'cue',
    showCopyButton: true,
  },
};

/**
 * CUE assembly specification demonstrating microservices configuration.
 */
export const CueAssembly: Story = {
  args: {
    title: 'CUE Assembly Specification',
    data: assemblySpecCue,
    language: 'cue',
    showCopyButton: true,
  },
};

/**
 * Complex TypeScript project configuration in CUE format.
 */
export const CueTypeScriptProject: Story = {
  args: {
    title: 'TypeScript Project in CUE',
    data: complexTypescriptProjectCue,
    language: 'cue',
    showCopyButton: true,
  },
};

/**
 * JSON data display with proper formatting and highlighting.
 */
export const JsonData: Story = {
  args: {
    title: 'Resolved Specification Data',
    data: sampleResolvedData,
    language: 'json',
    showCopyButton: true,
  },
};

/**
 * Nested JSON object showing complex data structures.
 */
export const ComplexJsonData: Story = {
  args: {
    title: 'Complex Project Configuration',
    data: {
      project: {
        name: 'Advanced TypeScript Microservice',
        version: 'v3.2.1',
        language: 'TypeScript',
        runtime: 'Node.js',
      },
      services: {
        auth_service: {
          name: 'Authentication Service',
          version: 'v2.1.0',
          status: 'production',
          endpoints: [
            { path: '/login', method: 'POST' },
            { path: '/logout', method: 'POST' },
            { path: '/refresh', method: 'POST' },
            { path: '/forgot-password', method: 'POST' },
          ],
          database: {
            type: 'PostgreSQL',
            version: '15',
            schemas: ['users', 'sessions', 'audit_logs'],
          },
          dependencies: ['redis', 'vault', 'sendgrid'],
        },
        user_service: {
          name: 'User Management Service',
          version: 'v1.8.2',
          status: 'production',
          depends_on: ['auth_service'],
          endpoints: [
            { path: '/profile', methods: ['GET', 'PUT'] },
            { path: '/settings', methods: ['GET', 'PUT'] },
            { path: '/delete', method: 'DELETE' },
            { path: '/export', method: 'GET' },
          ],
        },
      },
      infrastructure: {
        kubernetes: {
          version: '1.28',
          nodes: {
            min: 2,
            max: 10,
            machine_type: 'e2-standard-4',
          },
        },
        databases: {
          postgres: {
            tier: 'db-custom-2-8192',
            storage: '100GB',
            backup_retention: '7 days',
          },
          redis: {
            memory_size: '4GB',
            replicas: 2,
          },
        },
      },
    },
    language: 'json',
    showCopyButton: true,
  },
};

/**
 * YAML configuration file display.
 */
export const YamlConfig: Story = {
  args: {
    title: 'Kubernetes Deployment Configuration',
    data: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: production
  labels:
    app: auth-service
    version: v2.1.0
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
        version: v2.1.0
    spec:
      containers:
      - name: auth-service
        image: auth-service:v2.1.0
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5`,
    language: 'yaml',
    showCopyButton: true,
  },
};

/**
 * TypeScript code example with type annotations.
 */
export const TypeScriptCode: Story = {
  args: {
    title: 'TypeScript Interface Definition',
    data: `interface ServiceConfiguration {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  
  database: {
    host: string;
    port: number;
    credentials: {
      username: string;
      password: string;
    };
    pool: {
      min: number;
      max: number;
      idleTimeout: number;
    };
  };
  
  monitoring: {
    enabled: boolean;
    metricsPort: number;
    healthCheckPath: string;
  };
}

class ServiceManager {
  private config: ServiceConfiguration;
  
  constructor(config: ServiceConfiguration) {
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    await this.connectToDatabase();
    await this.setupMonitoring();
    console.log(\`Service \${this.config.name} initialized\`);
  }
  
  private async connectToDatabase(): Promise<void> {
    // Database connection logic
  }
  
  private async setupMonitoring(): Promise<void> {
    // Monitoring setup logic
  }
}`,
    language: 'typescript',
    showCopyButton: true,
  },
};

/**
 * JavaScript code example.
 */
export const JavaScriptCode: Story = {
  args: {
    title: 'JavaScript Configuration Module',
    data: `const config = {
  development: {
    api: {
      baseUrl: 'http://localhost:8080',
      timeout: 5000,
    },
    database: {
      host: 'localhost',
      port: 5432,
      database: 'app_dev',
    },
  },
  
  production: {
    api: {
      baseUrl: process.env.API_BASE_URL,
      timeout: 10000,
    },
    database: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      database: process.env.DB_NAME,
    },
  },
};

function getConfig(environment = 'development') {
  const envConfig = config[environment];
  
  if (!envConfig) {
    throw new Error(\`Unknown environment: \${environment}\`);
  }
  
  return {
    ...envConfig,
    environment,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { getConfig };`,
    language: 'javascript',
    showCopyButton: true,
  },
};

/**
 * Compact version without title or copy button for embedding.
 */
export const Compact: Story = {
  args: {
    data: {
      status: 'success',
      data: {
        users: 1250,
        active_sessions: 324,
        api_calls_today: 15678,
      },
      timestamp: '2024-01-15T10:30:00Z',
    },
    language: 'json',
    showCopyButton: false,
    className: 'max-w-md',
  },
};

/**
 * Large format for presentations or detailed review.
 */
export const LargeFormat: Story = {
  args: {
    title: 'Large Format CUE Specification',
    data: complexTypescriptProjectCue,
    language: 'cue',
    showCopyButton: true,
    className: 'text-base max-h-screen',
  },
  parameters: {
    viewport: {
      viewports: {
        largeDesktop: {
          name: 'Large Desktop',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
      },
      defaultViewport: 'largeDesktop',
    },
  },
};