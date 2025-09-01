/**
 * Basic usage example for @arbiter/sdk
 * 
 * This example demonstrates:
 * - Creating an Arbiter client
 * - Validating architecture configurations
 * - Explaining validation errors
 * - Exporting to different formats
 * - Checking server compatibility
 */

import { ArbiterClient } from '../src/index.js';

async function main() {
  console.log('🏗️  Arbiter SDK Example: Basic Usage\n');

  // Create client
  const client = new ArbiterClient({
    baseUrl: process.env.ARBITER_URL || 'http://localhost:3000',
    timeout: 30000,
    debug: true,
  });

  try {
    // 1. Check server compatibility
    console.log('1. Checking server compatibility...');
    const compatibility = await client.checkCompatibility();
    console.log(`   SDK: ${compatibility.sdkVersion}, Server: ${compatibility.serverVersion}`);
    console.log(`   Compatible: ${compatibility.compatible ? '✅' : '❌'}`);
    
    if (!compatibility.compatible) {
      console.log('   Issues:', compatibility.messages?.join(', '));
      return;
    }

    // 2. Define architecture schema
    const schema = `
      // API specification schema
      #APISpec: {
        version: string
        name: string
        baseURL: string & =~"^https?://"
        
        endpoints: [string]: {
          method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
          path: string & =~"^/"
          description?: string
          auth: "required" | "optional" | "none"
          rateLimit?: {
            requestsPerMinute: int & >0 & <=10000
            burst?: int & >0
          }
          request?: {
            contentType?: string
            schema?: {...}
          }
          response: {
            contentType: string | *"application/json"
            schema: {...}
          }
        }
        
        // Global rate limiting
        globalRateLimit?: {
          requestsPerMinute: int & >0 & <=50000
          concurrent?: int & >0 & <=1000
        }
      }
    `;

    // 3. Define configuration (with intentional error)
    const configWithError = `
      myAPI: #APISpec & {
        version: "2.1.0"
        name: "User Management API"
        baseURL: "invalid-url"  // This will cause a validation error
        
        endpoints: {
          getUsers: {
            method: "GET"
            path: "/api/v2/users"
            description: "Retrieve all users with pagination"
            auth: "required"
            rateLimit: {
              requestsPerMinute: 100
              burst: 20
            }
            response: {
              contentType: "application/json"
              schema: {
                users: [...{
                  id: string
                  name: string
                  email: string & =~"^[\\w._%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$"
                  createdAt: string // ISO date
                }]
                pagination: {
                  page: int & >=1
                  limit: int & >=1 & <=100
                  total: int & >=0
                  hasNext: bool
                }
              }
            }
          }
          
          createUser: {
            method: "POST"
            path: "/api/v2/users"
            description: "Create a new user"
            auth: "required"
            rateLimit: {
              requestsPerMinute: 20
            }
            request: {
              contentType: "application/json"
              schema: {
                name: string & len >2
                email: string & =~"^[\\w._%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$"
                role?: "admin" | "user" | *"user"
              }
            }
            response: {
              contentType: "application/json"
              schema: {
                id: string
                name: string
                email: string
                role: string
                createdAt: string
              }
            }
          }
          
          updateUser: {
            method: "PUT"
            path: "/api/v2/users/{id}"
            description: "Update an existing user"
            auth: "required"
            rateLimit: {
              requestsPerMinute: 50
            }
            request: {
              contentType: "application/json"
              schema: {
                name?: string & len >2
                email?: string & =~"^[\\w._%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$"
                role?: "admin" | "user"
              }
            }
            response: {
              contentType: "application/json"  
              schema: {
                id: string
                name: string
                email: string
                role: string
                updatedAt: string
              }
            }
          }
          
          health: {
            method: "GET"
            path: "/health"
            description: "Health check endpoint"
            auth: "none"
            response: {
              contentType: "application/json"
              schema: {
                status: "healthy" | "unhealthy"
                timestamp: string
                version: string
              }
            }
          }
        }
        
        globalRateLimit: {
          requestsPerMinute: 1000
          concurrent: 100
        }
      }
    `;

    // 4. Validate architecture (this will fail)
    console.log('\n2. Validating architecture with errors...');
    const errorResult = await client.validateArchitecture({
      schema,
      config: configWithError,
      requestId: 'example-validation-1',
    });

    console.log(`   Valid: ${errorResult.valid ? '✅' : '❌'}`);
    console.log(`   Violations: ${errorResult.violations.errors} errors, ${errorResult.violations.warnings} warnings`);

    if (!errorResult.valid) {
      console.log('\n3. Explaining validation errors...');
      const explanations = await client.explain(errorResult.errors);
      
      explanations.forEach((explanation, index) => {
        console.log(`   Error ${index + 1}:`);
        console.log(`     Message: ${explanation.error.message}`);
        console.log(`     Location: Line ${explanation.error.line}, Column ${explanation.error.column}`);
        console.log(`     Explanation: ${explanation.explanation}`);
        if (explanation.suggestions.length > 0) {
          console.log(`     Suggestions: ${explanation.suggestions.join(', ')}`);
        }
        console.log(`     Category: ${explanation.category}`);
        console.log('');
      });
    }

    // 5. Fix the configuration
    const validConfig = configWithError.replace(
      'baseURL: "invalid-url"',
      'baseURL: "https://api.example.com"'
    );

    console.log('4. Validating corrected architecture...');
    const validResult = await client.validateArchitecture({
      schema,
      config: validConfig,
      requestId: 'example-validation-2',
    });

    console.log(`   Valid: ${validResult.valid ? '✅' : '❌'}`);
    
    if (validResult.valid) {
      console.log('   ✨ Architecture validation successful!');
      
      // 6. Export to different formats
      console.log('\n5. Exporting architecture to different formats...');
      
      try {
        // Export to OpenAPI
        console.log('   Exporting to OpenAPI...');
        const openapi = await client.export(validConfig, {
          format: 'openapi',
          includeExamples: true,
          strict: false,
        });
        
        if (openapi.success) {
          console.log('   ✅ OpenAPI export successful');
          console.log(`   Generated at: ${openapi.metadata.generatedAt}`);
          // Truncate output for readability
          const output = typeof openapi.output === 'string' 
            ? openapi.output.substring(0, 200) + '...'
            : JSON.stringify(openapi.output).substring(0, 200) + '...';
          console.log(`   Sample output: ${output}`);
        } else {
          console.log('   ❌ OpenAPI export failed');
        }
      } catch (error) {
        console.log(`   ❌ Export error: ${error instanceof Error ? error.message : error}`);
      }

      try {
        // Export to TypeScript
        console.log('   Exporting to TypeScript...');
        const typescript = await client.export(validConfig, {
          format: 'typescript',
          outputMode: 'single',
        });
        
        if (typescript.success) {
          console.log('   ✅ TypeScript export successful');
          const output = typeof typescript.output === 'string' 
            ? typescript.output.substring(0, 200) + '...'
            : JSON.stringify(typescript.output).substring(0, 200) + '...';
          console.log(`   Sample output: ${output}`);
        } else {
          console.log('   ❌ TypeScript export failed');
        }
      } catch (error) {
        console.log(`   ❌ TypeScript export error: ${error instanceof Error ? error.message : error}`);
      }

      // 7. Show available formats
      console.log('\n6. Available export formats:');
      try {
        const formats = await client.getSupportedFormats();
        formats.forEach(format => {
          console.log(`   - ${format.format}: ${format.description}`);
        });
      } catch (error) {
        console.log(`   Error getting formats: ${error instanceof Error ? error.message : error}`);
      }

      // 8. Show graph structure if available
      if (validResult.graph && validResult.graph.length > 0) {
        console.log('\n7. Architecture graph structure:');
        validResult.graph.slice(0, 5).forEach(node => {
          console.log(`   - ${node.id}: ${node.label} (${node.type})`);
          if (node.children && node.children.length > 0) {
            console.log(`     Children: ${node.children.slice(0, 3).join(', ')}${node.children.length > 3 ? '...' : ''}`);
          }
        });
        if (validResult.graph.length > 5) {
          console.log(`   ... and ${validResult.graph.length - 5} more nodes`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error occurred:', error);
    
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }

  console.log('\n✨ Example completed!');
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}

export { main as basicUsageExample };