/**
 * EditorPane Component Stories
 * Comprehensive documentation for the editor pane container that combines file tree and Monaco editor
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import EditorPane from './EditorPane';
import { AppProvider, useApp } from '../../contexts/AppContext';
import type { Fragment, Project } from '../../types/api';

// Sample data
const mockProject: Project = {
  id: 'demo-project',
  name: 'E-commerce API Specification',
  description: 'Complete API specification for an e-commerce platform with user management, product catalog, and payment processing.',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:30:00Z'
};

const mockFragments: Fragment[] = [
  {
    id: '1',
    project_id: 'demo-project',
    path: 'main.cue',
    content: `// E-commerce API Specification
package main

import "strings"

// Application metadata
app: {
	name:    "ecommerce-api"
	version: "2.1.0"
	env:     "production" | "staging" | "development"
}

// Server configuration
server: {
	host: string | *"0.0.0.0"
	port: int & >1024 & <65536 | *8080
	ssl: {
		enabled: bool | *true
		cert:    string
		key:     string
	}
}

// Database configuration
database: {
	driver: "postgres" | "mysql" | "sqlite"
	host:   string
	port:   int & >0
	name:   string
	user:   string
	password: string & len(password) >= 8
	
	// Connection pool settings
	pool: {
		min: int & >=0 | *5
		max: int & >min | *20
		timeout: int & >0 | *30
	}
}`,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    project_id: 'demo-project',
    path: 'api/products.cue',
    content: `// Product API Specification
package api

// Product data model
#Product: {
	id:          string
	name:        string & len(name) > 0 & len(name) <= 100
	description: string & len(description) <= 1000
	price:       number & >=0
	currency:    "USD" | "EUR" | "GBP" | *"USD"
	category:    string
	tags:        [...string]
	status:      "active" | "inactive" | "discontinued"
	
	// Inventory tracking
	inventory: {
		quantity:     int & >=0
		reserved:     int & >=0 & <=quantity
		threshold:    int & >=0 | *10
		unlimited:    bool | *false
	}
	
	// Timestamps
	created_at: string
	updated_at: string
}

// Product API endpoints
products: {
	// List products with filtering and pagination
	list: {
		method: "GET"
		path:   "/products"
		query: {
			page?:     int & >=1 | *1
			limit?:    int & >=1 & <=100 | *20
			category?: string
			status?:   "active" | "inactive" | "discontinued"
			search?:   string
		}
		response: {
			products: [...#Product]
			pagination: {
				page:       int
				limit:      int
				total:      int
				has_next:   bool
				has_prev:   bool
			}
		}
	}
	
	// Get single product
	get: {
		method: "GET"
		path:   "/products/{id}"
		params: {
			id: string
		}
		response: #Product
	}
	
	// Create new product
	create: {
		method: "POST"
		path:   "/products"
		body: #Product & {
			id?: string // Generated if not provided
		}
		response: #Product
	}
}`,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:15:00Z'
  },
  {
    id: '3',
    project_id: 'demo-project',
    path: 'api/users.cue',
    content: `// User Management API
package api

// User data model
#User: {
	id:         string
	email:      string & =~"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$"
	username:   string & len(username) >= 3 & len(username) <= 30
	first_name: string & len(first_name) > 0
	last_name:  string & len(last_name) > 0
	role:       "admin" | "manager" | "customer" | *"customer"
	status:     "active" | "inactive" | "suspended"
	
	// Profile information
	profile: {
		phone?:       string
		date_of_birth?: string
		address?: {
			street:   string
			city:     string
			state:    string
			zip:      string
			country:  string | *"US"
		}
	}
	
	// Account settings
	settings: {
		newsletter:     bool | *false
		notifications: {
			email: bool | *true
			sms:   bool | *false
		}
		privacy: {
			profile_public: bool | *false
			activity_tracking: bool | *true
		}
	}
	
	created_at: string
	updated_at: string
	last_login?: string
}`,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:20:00Z'
  },
  {
    id: '4',
    project_id: 'demo-project',
    path: 'api/orders.cue',
    content: `// Order Management API
package api

// Order data model
#Order: {
	id:     string
	user_id: string
	status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"
	
	// Order items
	items: [...{
		product_id: string
		quantity:   int & >0
		price:      number & >=0
		total:      number & >=0
	}]
	
	// Pricing breakdown
	pricing: {
		subtotal:     number & >=0
		tax:          number & >=0
		shipping:     number & >=0
		discount:     number & >=0
		total:        number & >=0
	}
	
	// Shipping information
	shipping: {
		method: "standard" | "express" | "overnight"
		address: {
			name:    string
			street:  string
			city:    string
			state:   string
			zip:     string
			country: string
		}
		tracking_number?: string
	}
	
	created_at: string
	updated_at: string
}`,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:25:00Z'
  },
  {
    id: '5',
    project_id: 'demo-project',
    path: 'config/environments/production.cue',
    content: `// Production Environment Configuration
package config

production: {
	app: {
		env:     "production"
		debug:   false
		log_level: "info"
	}
	
	server: {
		host: "api.ecommerce.com"
		port: 443
		ssl: {
			enabled: true
			cert: "/etc/ssl/certs/api.ecommerce.com.crt"
			key:  "/etc/ssl/private/api.ecommerce.com.key"
		}
	}
	
	database: {
		driver: "postgres"
		host:   "prod-db.ecommerce.internal"
		port:   5432
		name:   "ecommerce_prod"
		user:   "api_user"
		password: string // Loaded from environment
		
		pool: {
			min: 10
			max: 50
			timeout: 30
		}
	}
	
	redis: {
		host: "prod-redis.ecommerce.internal"
		port: 6379
		db:   0
	}
	
	monitoring: {
		enabled: true
		metrics_endpoint: "/metrics"
		health_endpoint:  "/health"
	}
}`,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  }
];

// Story context initializer component
interface StoryContextInitializerProps {
  children: React.ReactNode;
  project?: Project | null;
  fragments?: Fragment[];
  activeFragmentId?: string | null;
  unsavedChanges?: Set<string>;
  editorContent?: Record<string, string>;
  isLoading?: boolean;
  error?: string | null;
}

const StoryContextInitializer = ({ 
  children, 
  project = mockProject,
  fragments = mockFragments, 
  activeFragmentId = null, 
  unsavedChanges = new Set(),
  editorContent = {},
  isLoading = false,
  error = null
}: StoryContextInitializerProps) => {
  const { dispatch, updateEditorContent, markUnsaved, markSaved, setError, setLoading } = useApp();

  useEffect(() => {
    // Initialize the context with story data
    if (project) {
      dispatch({ type: 'SET_PROJECT', payload: project });
    }
    
    if (fragments) {
      dispatch({ type: 'SET_FRAGMENTS', payload: fragments });
    }
    
    if (activeFragmentId) {
      dispatch({ type: 'SET_ACTIVE_FRAGMENT', payload: activeFragmentId });
    }

    if (error) {
      setError(error);
    }

    if (isLoading) {
      setLoading(isLoading);
    }

    // Set up editor content
    Object.entries(editorContent).forEach(([fragmentId, content]) => {
      updateEditorContent(fragmentId, content);
    });

    // Set up unsaved changes
    unsavedChanges.forEach(id => {
      markUnsaved(id);
    });
  }, [project, fragments, activeFragmentId, editorContent, unsavedChanges, isLoading, error, dispatch, updateEditorContent, markUnsaved, setError, setLoading]);

  return <>{children}</>;
};

const meta = {
  title: 'Editor/EditorPane',
  component: EditorPane,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The main editor pane that combines a file tree browser and Monaco code editor in a resizable split layout. Provides a complete development environment for editing CUE specifications.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => (
      <AppProvider>
        <StoryContextInitializer {...(context.args.mockContext || {})}>
          <div className="h-screen w-full">
            <Story />
          </div>
        </StoryContextInitializer>
      </AppProvider>
    ),
  ],
  argTypes: {
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof EditorPane>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default editor pane
export const Default: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: mockFragments,
      activeFragmentId: '1', // main.cue
      editorContent: {
        '1': mockFragments[0].content // Load the content in editor
      }
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Default editor pane with file tree on top and Monaco editor below. Shows the main.cue file loaded and ready for editing.',
      },
    },
  },
};

// No project selected
export const NoProject: Story = {
  args: {
    mockContext: {
      project: null,
      fragments: [],
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Editor pane when no project is selected. Shows an empty state prompting the user to select a project.',
      },
    },
  },
};

// Empty project
export const EmptyProject: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: [],
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Editor pane with an empty project. File tree shows empty state, editor shows welcome message.',
      },
    },
  },
};

// With active file and unsaved changes
export const WithUnsavedChanges: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: mockFragments,
      activeFragmentId: '2', // api/products.cue
      unsavedChanges: new Set(['2']),
      editorContent: {
        '2': mockFragments[1].content + '\n\n// Modified content\n// This change hasn\'t been saved yet'
      }
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Editor pane showing a file with unsaved changes. Notice the modified indicator in the header and the amber styling.',
      },
    },
  },
};

// Multiple files with changes
export const MultipleUnsavedFiles: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: mockFragments,
      activeFragmentId: '3', // api/users.cue
      unsavedChanges: new Set(['1', '2', '3']),
      editorContent: {
        '1': mockFragments[0].content + '\n// Updated main config',
        '2': mockFragments[1].content + '\n// Updated products API',
        '3': mockFragments[2].content + '\n// Updated users API'
      }
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Editor pane with multiple files having unsaved changes. File tree shows amber indicators for all modified files.',
      },
    },
  },
};

// Large project structure
export const LargeProject: Story = {
  args: {
    mockContext: {
      project: {
        ...mockProject,
        name: 'Enterprise E-commerce Platform',
        description: 'Complete microservices architecture specification for a large-scale e-commerce platform'
      },
      fragments: [
        ...mockFragments,
        {
          id: '6',
          project_id: 'demo-project',
          path: 'api/auth/jwt.cue',
          content: '// JWT authentication configuration',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '7',
          project_id: 'demo-project',
          path: 'api/auth/oauth.cue',
          content: '// OAuth2 authentication configuration',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '8',
          project_id: 'demo-project',
          path: 'api/payments/stripe.cue',
          content: '// Stripe payment integration',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '9',
          project_id: 'demo-project',
          path: 'api/payments/paypal.cue',
          content: '// PayPal payment integration',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '10',
          project_id: 'demo-project',
          path: 'database/migrations/001_initial.sql',
          content: '-- Initial database schema',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '11',
          project_id: 'demo-project',
          path: 'config/environments/staging.cue',
          content: '// Staging environment configuration',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '12',
          project_id: 'demo-project',
          path: 'docs/api-reference.md',
          content: '# API Reference Documentation',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        }
      ],
      activeFragmentId: '8', // api/payments/stripe.cue
      editorContent: {
        '8': `// Stripe Payment Integration
package payments

// Stripe configuration
stripe: {
	api_key:     string
	webhook_secret: string
	api_version: "2023-10-16"
	
	// Payment methods
	payment_methods: [
		"card",
		"sepa_debit",
		"ideal",
		"giropay",
		"sofort"
	]
	
	// Webhook events
	webhooks: {
		enabled: true
		events: [
			"payment_intent.succeeded",
			"payment_intent.payment_failed",
			"charge.dispute.created"
		]
		endpoint: "/webhooks/stripe"
	}
}`
      }
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Editor pane with a large, complex project structure showing deep folder nesting and various file types.',
      },
    },
  },
};

// Loading state
export const Loading: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: [],
      isLoading: true,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Editor pane in loading state. Shows loading indicators while project data is being fetched.',
      },
    },
  },
};

// Error state
export const WithError: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: mockFragments,
      error: 'Failed to save fragment: Network connection lost. Please check your internet connection and try again.',
      activeFragmentId: '1',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Editor pane showing an error state. Error messages are displayed to inform users of issues.',
      },
    },
  },
};

// Different file types editing
export const DifferentFileTypes: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: [
        {
          id: '1',
          project_id: 'demo-project',
          path: 'config.cue',
          content: '// CUE configuration\npackage config\n\napp: {\n  name: "demo"\n  version: "1.0.0"\n}',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '2',
          project_id: 'demo-project',
          path: 'package.json',
          content: '{\n  "name": "ecommerce-api",\n  "version": "1.0.0",\n  "description": "E-commerce API",\n  "main": "index.js"\n}',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '3',
          project_id: 'demo-project',
          path: 'README.md',
          content: '# E-commerce API\n\nThis is a comprehensive API specification for an e-commerce platform.\n\n## Features\n\n- User management\n- Product catalog\n- Order processing\n- Payment integration',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z'
        }
      ],
      activeFragmentId: '2', // package.json
      editorContent: {
        '2': '{\n  "name": "ecommerce-api",\n  "version": "1.0.0",\n  "description": "E-commerce API",\n  "main": "index.js"\n}'
      }
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Editor pane showing different file types: CUE, JSON, and Markdown. Each file type gets appropriate syntax highlighting.',
      },
    },
  },
};

// Custom styling
export const CustomStyling: Story = {
  args: {
    mockContext: {
      project: mockProject,
      fragments: mockFragments,
      activeFragmentId: '1',
      editorContent: {
        '1': mockFragments[0].content
      }
    },
    className: 'border-2 border-purple-200 rounded-xl shadow-xl bg-gradient-to-br from-purple-50 to-blue-50',
  },
  parameters: {
    docs: {
      description: {
        story: 'Editor pane with custom styling applied. Shows how the component can be themed for different design contexts.',
      },
    },
  },
};

// Interactive demo
export const Interactive: Story = {
  render: (args) => {
    return (
      <AppProvider>
        <StoryContextInitializer
          project={mockProject}
          fragments={mockFragments}
          activeFragmentId="1"
          editorContent={{ '1': mockFragments[0].content }}
        >
          <div className="h-screen w-full">
            <EditorPane {...args} />
          </div>
        </StoryContextInitializer>
      </AppProvider>
    );
  },
  args: {
    className: '',
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive editor pane demo. Try clicking on different files, editing content, and using keyboard shortcuts like Ctrl+S to save.',
      },
    },
  },
};