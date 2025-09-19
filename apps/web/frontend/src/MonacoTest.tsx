/**
 * Simple test component for Monaco Editor CUE syntax highlighting
 */

import React, { useState } from 'react';
import MonacoEditor from './components/Editor/MonacoEditor';

const sampleCueCode = `// CUE Language Test
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
#ValidEmail: string & =~"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$"

// Environment-specific overrides
if strings.HasPrefix(app.name, "dev-") {
    app.features.debug: true
    app.database.port: 5432
}

// Template example
for user in users {
    "user_\\(user.name)": #User & user
}

// Complex constraint
config: {
    host: string & len(host) > 0
    port: int & >1024 & <65536
    if ssl {
        port: 443
    }
}`;

export default function MonacoTest() {
  const [code, setCode] = useState(sampleCueCode);
  const [theme, setTheme] = useState<'vs' | 'vs-dark' | 'cue-light' | 'cue-dark'>('cue-light');
  const [errors, setErrors] = useState<string[]>([]);

  const handleEditorReady = (editor: any) => {
    console.log('Monaco Editor is ready!', editor);

    // Test if CUE language is registered
    const monaco = (window as any).monaco;
    if (monaco) {
      const languages = monaco.languages.getLanguages();
      const cueLanguage = languages.find((lang: any) => lang.id === 'cue');

      if (cueLanguage) {
        console.log('✓ CUE language is registered');
      } else {
        setErrors(prev => [...prev, 'CUE language is not registered']);
      }

      // Test tokenization
      try {
        const tokens = monaco.editor.tokenize('package test', 'cue');
        console.log('✓ CUE tokenization working:', tokens);
      } catch (error) {
        console.error('✗ CUE tokenization failed:', error);
        setErrors(prev => [...prev, `Tokenization error: ${error}`]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Monaco Editor CUE Syntax Test</h1>

          <div className="flex gap-4 items-center mb-4">
            <label className="flex items-center gap-2">
              <span className="text-sm font-medium">Theme:</span>
              <select
                value={theme}
                onChange={e => setTheme(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="cue-light">CUE Light</option>
                <option value="cue-dark">CUE Dark</option>
                <option value="vs">VS Light</option>
                <option value="vs-dark">VS Dark</option>
              </select>
            </label>

            <button
              onClick={() => setErrors([])}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
            >
              Clear Errors
            </button>
          </div>

          {errors.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-sm font-medium text-red-800 mb-2">Errors:</h3>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              CUE Editor with Syntax Highlighting
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Testing CUE language features: package declarations, imports, constraints, unification
              operators, templates, and more.
            </p>
          </div>

          <div className="h-96">
            <MonacoEditor
              value={code}
              onChange={setCode}
              language="cue"
              theme={theme}
              onEditorReady={handleEditorReady}
              options={{
                automaticLayout: true,
                fontSize: 14,
                fontFamily: "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
                lineHeight: 21,
                minimap: { enabled: true, scale: 0.8 },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                folding: true,
                matchBrackets: 'always',
                autoIndent: 'advanced',
                tabSize: 2,
                insertSpaces: true,
              }}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Expected Highlights</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#0000FF' }}></div>
                <span>
                  Keywords: <code>package</code>, <code>import</code>, <code>if</code>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#1976D2' }}></div>
                <span>
                  Types: <code>string</code>, <code>int</code>, <code>bool</code>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#CE9178' }}></div>
                <span>
                  Strings: <code>"arbiter"</code>, <code>"/health"</code>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#098658' }}></div>
                <span>
                  Numbers: <code>8080</code>, <code>3000</code>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FF9F43' }}></div>
                <span>
                  Unification: <code>&</code>, <code>|</code>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#4ECDC4' }}></div>
                <span>
                  Constraints: <code>=~</code>, <code>&gt;</code>, <code>&lt;=</code>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#6A9955' }}></div>
                <span>
                  Comments: <code>// CUE Language Test</code>
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Debug Info</h3>
            <div className="text-sm space-y-2">
              <div>
                <strong>Editor Language:</strong> cue
              </div>
              <div>
                <strong>Current Theme:</strong> {theme}
              </div>
              <div>
                <strong>Character Count:</strong> {code.length}
              </div>
              <div>
                <strong>Line Count:</strong> {code.split('\\n').length}
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => {
                  console.log('Current editor state:', code.substring(0, 100) + '...');
                  if ((window as any).monaco) {
                    const monaco = (window as any).monaco;
                    console.log('Registered languages:', monaco.languages.getLanguages());
                    console.log(
                      'Sample tokenization:',
                      monaco.editor.tokenize('package test', 'cue')
                    );
                  }
                }}
                className="px-4 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
              >
                Log Debug Info
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
