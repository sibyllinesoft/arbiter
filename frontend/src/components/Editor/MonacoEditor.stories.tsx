/**
 * MonacoEditor Component Stories
 * Comprehensive documentation for the Monaco code editor wrapper with CUE language support
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import MonacoEditor from './MonacoEditor';

const meta = {
  title: 'Editor/MonacoEditor',
  component: MonacoEditor,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A Monaco Editor wrapper component with CUE syntax highlighting, custom themes, and developer-friendly features. Includes auto-completion, hover documentation, and keyboard shortcuts.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'text' },
      description: 'The editor content value',
    },
    language: {
      control: { type: 'select' },
      options: ['cue', 'typescript', 'javascript', 'json', 'yaml'],
      description: 'Programming language for syntax highlighting',
    },
    theme: {
      control: { type: 'select' },
      options: ['vs', 'vs-dark', 'hc-black', 'cue-light'],
      description: 'Editor theme',
    },
    onChange: {
      description: 'Callback fired when the editor content changes',
    },
    onSave: {
      description: 'Callback fired when Ctrl+S is pressed',
    },
    onEditorReady: {
      description: 'Callback fired when the editor is ready',
    },
    fragmentId: {
      control: { type: 'text' },
      description: 'Optional fragment ID for context',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof MonacoEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample CUE code
const sampleCueCode = `// Sample CUE specification
package config

import "strings"

// Application configuration
app: {
	name:    "arbiter"
	version: "1.0.0"
	port:    8080 | *3000
	
	database: {
		host:     string
		port:     int & >0 & <65536
		username: string
		password: string & len(password) > 8
	}
	
	features: {
		auth:      bool | *true
		analytics: bool | *false
		debug:     bool | *false
	}
}

// API endpoints configuration
api: {
	endpoints: [
		{
			path:   "/health"
			method: "GET"
			auth:   false
		},
		{
			path:   "/users"
			method: "GET" | "POST"
			auth:   true
		},
	]
}

// Validation constraints
#ValidPort: int & >1024 & <65536
#ValidEmail: string & =~"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"

// Environment-specific overrides
if strings.HasPrefix(app.name, "dev-") {
	app.features.debug: true
	app.database.port: 5432
}`;

// TypeScript sample
const sampleTypeScriptCode = `// TypeScript interface example
interface User {
  id: number;
  name: string;
  email: string;
  roles: Role[];
  createdAt: Date;
  updatedAt?: Date;
}

interface Role {
  id: number;
  name: string;
  permissions: Permission[];
}

interface Permission {
  resource: string;
  actions: ('read' | 'write' | 'delete')[];
}

// Generic utility type
type ApiResponse<T> = {
  data: T;
  status: 'success' | 'error';
  message?: string;
  timestamp: string;
};

// Function with proper typing
async function fetchUser(id: number): Promise<ApiResponse<User>> {
  const response = await fetch(\`/api/users/\${id}\`);
  const data = await response.json();
  
  return {
    data,
    status: response.ok ? 'success' : 'error',
    message: response.ok ? undefined : 'Failed to fetch user',
    timestamp: new Date().toISOString()
  };
}

// Advanced type manipulation
type UserWithoutTimestamps = Omit<User, 'createdAt' | 'updatedAt'>;
type PartialUser = Partial<User>;
type RequiredUser = Required<User>;`;

// JSON sample
const sampleJsonCode = `{
  "name": "arbiter-frontend",
  "version": "1.0.0",
  "description": "React frontend for Arbiter specification workbench",
  "main": "src/main.tsx",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@monaco-editor/react": "^4.6.0",
    "clsx": "^2.0.0",
    "lucide-react": "^0.263.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@vitejs/plugin-react": "^4.0.3",
    "typescript": "^5.0.2",
    "vite": "^4.4.5"
  }
}`;

// Basic editor with CUE code
export const Default: Story = {
  render: () => {
    const [code, setCode] = useState(sampleCueCode);
    
    return (
      <div className="h-96 border border-gray-200 rounded-lg">
        <MonacoEditor
          value={code}
          onChange={setCode}
          language="cue"
          theme="cue-light"
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Default Monaco editor with CUE syntax highlighting and the custom CUE light theme.',
      },
    },
  },
};

// Dark theme
export const DarkTheme: Story = {
  render: () => {
    const [code, setCode] = useState(sampleCueCode);
    
    return (
      <div className="h-96 border border-gray-200 rounded-lg">
        <MonacoEditor
          value={code}
          onChange={setCode}
          language="cue"
          theme="vs-dark"
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Monaco editor with dark theme, perfect for low-light environments.',
      },
    },
  },
};

// TypeScript support
export const TypeScriptEditor: Story = {
  render: () => {
    const [code, setCode] = useState(sampleTypeScriptCode);
    
    return (
      <div className="h-96 border border-gray-200 rounded-lg">
        <MonacoEditor
          value={code}
          onChange={setCode}
          language="typescript"
          theme="vs"
          options={{
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: 'on',
            minimap: { enabled: true },
            wordWrap: 'on',
            folding: true,
            bracketMatching: 'always',
            autoIndent: 'advanced',
          }}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Monaco editor configured for TypeScript with IntelliSense support, type checking, and advanced code completion.',
      },
    },
  },
};

// JSON editor
export const JsonEditor: Story = {
  render: () => {
    const [code, setCode] = useState(sampleJsonCode);
    
    return (
      <div className="h-96 border border-gray-200 rounded-lg">
        <MonacoEditor
          value={code}
          onChange={setCode}
          language="json"
          theme="vs"
          options={{
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: 'on',
            minimap: { enabled: false },
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Monaco editor for JSON editing with validation, formatting, and schema support.',
      },
    },
  },
};

// Custom options
export const CustomOptions: Story = {
  render: () => {
    const [code, setCode] = useState(sampleCueCode);
    
    return (
      <div className="h-96 border border-gray-200 rounded-lg">
        <MonacoEditor
          value={code}
          onChange={setCode}
          language="cue"
          theme="cue-light"
          options={{
            automaticLayout: true,
            fontSize: 16,
            lineNumbers: 'off',
            minimap: { enabled: false },
            wordWrap: 'on',
            folding: false,
            renderLineHighlight: 'none',
            scrollBeyondLastLine: false,
            padding: { top: 20, bottom: 20 },
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            renderWhitespace: 'all',
            rulers: [80, 120],
          }}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Customized editor with larger font, no line numbers, disabled minimap, custom font family, whitespace rendering, and ruler guides.',
      },
    },
  },
};

// Read-only mode
export const ReadOnly: Story = {
  render: () => {
    return (
      <div className="h-96 border border-gray-200 rounded-lg">
        <MonacoEditor
          value={sampleCueCode}
          onChange={() => {}} // No-op for read-only
          language="cue"
          theme="cue-light"
          options={{
            readOnly: true,
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: 'on',
            minimap: { enabled: true },
            wordWrap: 'on',
            cursorStyle: 'line-thin',
            renderLineHighlight: 'gutter',
          }}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Read-only editor for displaying code that should not be modified. The cursor is thinner to indicate non-editable state.',
      },
    },
  },
};

// With save callback
export const WithSaveCallback: Story = {
  render: () => {
    const [code, setCode] = useState(sampleCueCode);
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    
    const handleSave = () => {
      setLastSaved(new Date().toLocaleTimeString());
      alert('File saved! Check the timestamp below the editor.');
    };
    
    return (
      <div className="space-y-4">
        <div className="h-80 border border-gray-200 rounded-lg">
          <MonacoEditor
            value={code}
            onChange={setCode}
            onSave={handleSave}
            language="cue"
            theme="cue-light"
          />
        </div>
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
          <strong>Tip:</strong> Press Ctrl+S (or Cmd+S on Mac) to save the file.
          {lastSaved && (
            <div className="mt-1 text-green-600">
              ✅ Last saved at: {lastSaved}
            </div>
          )}
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Editor with save functionality. Press Ctrl+S or Cmd+S to trigger the save callback.',
      },
    },
  },
};

// Multiple editors
export const MultipleEditors: Story = {
  render: () => {
    const [leftCode, setLeftCode] = useState(sampleCueCode);
    const [rightCode, setRightCode] = useState(sampleTypeScriptCode);
    
    return (
      <div className="h-96 flex gap-4">
        <div className="flex-1 border border-gray-200 rounded-lg">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-sm font-medium text-gray-700">
            config.cue
          </div>
          <div className="h-80">
            <MonacoEditor
              value={leftCode}
              onChange={setLeftCode}
              language="cue"
              theme="cue-light"
              options={{
                minimap: { enabled: false },
                lineNumbers: 'on',
                fontSize: 13,
              }}
            />
          </div>
        </div>
        <div className="flex-1 border border-gray-200 rounded-lg">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-sm font-medium text-gray-700">
            types.ts
          </div>
          <div className="h-80">
            <MonacoEditor
              value={rightCode}
              onChange={setRightCode}
              language="typescript"
              theme="vs"
              options={{
                minimap: { enabled: false },
                lineNumbers: 'on',
                fontSize: 13,
              }}
            />
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Side-by-side editors showing CUE and TypeScript files. Useful for diff views or multi-file editing.',
      },
    },
  },
};

// Small editor (embedded)
export const CompactEditor: Story = {
  render: () => {
    const [code, setCode] = useState(`// Compact configuration
app: {
	name: "demo"
	port: 3000
}`);
    
    return (
      <div className="max-w-md">
        <div className="h-32 border border-gray-200 rounded-lg">
          <MonacoEditor
            value={code}
            onChange={setCode}
            language="cue"
            theme="cue-light"
            options={{
              automaticLayout: true,
              fontSize: 12,
              lineNumbers: 'off',
              minimap: { enabled: false },
              wordWrap: 'on',
              folding: false,
              scrollBeyondLastLine: false,
              padding: { top: 8, bottom: 8 },
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden'
              },
            }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Compact editor for quick edits
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact editor suitable for embedding in forms or small spaces. Simplified interface with minimal chrome.',
      },
    },
  },
};

// CUE language features demonstration
export const CueLanguageFeatures: Story = {
  render: () => {
    const [code, setCode] = useState(`// CUE Language Features Demo
package demo

import "strings"

// Basic types and constraints
name: string & len(name) > 0
age:  int & >=0 & <=150
email: string & =~"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}"

// Struct definitions with defaults
config: {
	host:    string | *"localhost"
	port:    int & >1024 | *8080
	ssl:     bool | *false
	timeout: int & >0 | *30
}

// Lists and comprehensions
users: [
	{name: "alice", role: "admin"},
	{name: "bob", role: "user"},
]

// Conditional logic
if config.ssl {
	config.port: 443
}

// Template and patterns
#User: {
	name: string
	role: "admin" | "user" | "guest"
	permissions: [...string]
}

// Validation with custom constraints
#ValidConfig: {
	host: string & len(host) > 0
	port: int & >1024 & <65536
	if ssl {
		port: 443
	}
}

// Field references and computed values
computed: {
	baseUrl: "https://\\(config.host):\\(config.port)"
	users: len(users)
}

// Advanced patterns
for user in users {
	"user_\\(user.name)": #User & user
}`);
    
    return (
      <div className="h-96 border border-gray-200 rounded-lg">
        <MonacoEditor
          value={code}
          onChange={setCode}
          language="cue"
          theme="cue-light"
          options={{
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: 'on',
            minimap: { enabled: true, scale: 0.8 },
            wordWrap: 'on',
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'always',
          }}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Comprehensive example showcasing CUE language features: types, constraints, defaults, conditionals, templates, and computed values with proper syntax highlighting.',
      },
    },
  },
};

// Interactive playground
export const Interactive: Story = {
  render: (args) => {
    const [code, setCode] = useState(sampleCueCode);
    
    return (
      <div className="h-96 border border-gray-200 rounded-lg">
        <MonacoEditor
          value={code}
          onChange={setCode}
          {...args}
        />
      </div>
    );
  },
  args: {
    language: 'cue',
    theme: 'cue-light',
    fragmentId: 'interactive-demo',
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive playground to experiment with MonacoEditor props. Use the controls panel to test different languages, themes, and configurations.',
      },
    },
  },
};