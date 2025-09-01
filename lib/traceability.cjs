/**
 * Traceability System - Requirements ⇄ Spec ⇄ Plan ⇄ Tests ⇄ Code
 * 
 * Implements stable ID assignment and full traceability graph construction
 * per TODO.md section 8 requirements.
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Generate stable ID for different artifact types
 */
function generateStableId(type, content, context = {}) {
  const crypto = require('crypto');
  
  // Create deterministic hash based on content and context
  const hash = crypto.createHash('md5')
    .update(content + JSON.stringify(context))
    .digest('hex')
    .substring(0, 8);
  
  const typePrefix = {
    'requirement': 'REQ',
    'specification': 'SPEC', 
    'test': 'TEST',
    'code': 'CODE'
  }[type] || 'UNKNOWN';
  
  return `${typePrefix}-${hash.toUpperCase()}`;
}

/**
 * Extract requirements from CUE files
 */
async function extractRequirements() {
  const requirements = [];
  
  try {
    // Check for TODO.md requirements
    try {
      const todoContent = await fs.readFile('TODO.md', 'utf8');
      const reqMatches = todoContent.match(/^[\d\w\)]+\.\s+(.+)$/gm) || [];
      
      reqMatches.forEach((match, index) => {
        const content = match.replace(/^[\d\w\)]+\.\s+/, '');
        if (content.length > 10) { // Skip trivial entries
          requirements.push({
            id: generateStableId('requirement', content, { source: 'TODO.md', index }),
            content,
            source: 'TODO.md',
            location: { file: 'TODO.md', line: index + 1 }
          });
        }
      });
    } catch (error) {
      // TODO.md not found, continue
    }
    
    // Extract from CUE assembly files
    const assemblyFiles = ['arbiter.assembly.cue', 'assembly.cue'];
    
    for (const file of assemblyFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Look for requirement patterns in CUE comments
          const reqMatch = line.match(/\/\/\s*REQ:\s*(.+)$/);
          if (reqMatch) {
            const reqContent = reqMatch[1].trim();
            requirements.push({
              id: generateStableId('requirement', reqContent, { source: file, line: index }),
              content: reqContent,
              source: file,
              location: { file, line: index + 1 }
            });
          }
          
          // Look for schema definitions as implicit requirements
          const schemaMatch = line.match(/^(\w+):\s*{/);
          if (schemaMatch) {
            const schemaName = schemaMatch[1];
            const implicitReq = `Define ${schemaName} schema with validation rules`;
            requirements.push({
              id: generateStableId('requirement', implicitReq, { source: file, schema: schemaName }),
              content: implicitReq,
              source: file,
              location: { file, line: index + 1 },
              type: 'implicit_schema'
            });
          }
        });
        
        break; // Use first found assembly file
      } catch (error) {
        // File not found, continue
      }
    }
    
  } catch (error) {
    console.warn(`⚠️ Error extracting requirements: ${error.message}`);
  }
  
  return requirements;
}

/**
 * Extract specifications from CUE contracts
 */
async function extractSpecifications() {
  const specifications = [];
  
  try {
    // Find all CUE files in spec/ directory
    const specDir = 'spec';
    try {
      await fs.access(specDir);
      const specFiles = await findCueFiles(specDir);
      
      for (const file of specFiles) {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Look for contract definitions
          const contractMatch = line.match(/(\w+):\s*{/);
          if (contractMatch) {
            const contractName = contractMatch[1];
            specifications.push({
              id: generateStableId('specification', contractName, { source: file }),
              name: contractName,
              content: line.trim(),
              source: file,
              location: { file, line: index + 1 },
              type: 'contract'
            });
          }
          
          // Look for invariants
          const invariantMatch = line.match(/invariant:\s*(.+)$/);
          if (invariantMatch) {
            const invariantContent = invariantMatch[1];
            specifications.push({
              id: generateStableId('specification', invariantContent, { source: file, type: 'invariant' }),
              content: invariantContent,
              source: file,
              location: { file, line: index + 1 },
              type: 'invariant'
            });
          }
        });
      }
    } catch (error) {
      // spec/ directory not found
    }
    
    // Also check assembly file for embedded specs
    const assemblyFiles = ['arbiter.assembly.cue', 'assembly.cue'];
    for (const file of assemblyFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Look for SPEC: comments
          const specMatch = line.match(/\/\/\s*SPEC:\s*(.+)$/);
          if (specMatch) {
            const specContent = specMatch[1].trim();
            specifications.push({
              id: generateStableId('specification', specContent, { source: file }),
              content: specContent,
              source: file,
              location: { file, line: index + 1 },
              type: 'embedded_spec'
            });
          }
        });
        
        break;
      } catch (error) {
        // File not found, continue
      }
    }
    
  } catch (error) {
    console.warn(`⚠️ Error extracting specifications: ${error.message}`);
  }
  
  return specifications;
}

/**
 * Extract test artifacts and their traceability markers
 */
async function extractTests() {
  const tests = [];
  
  try {
    // Find test files in common locations
    const testDirs = ['test', 'tests', '__tests__', 'spec'];
    const testPatterns = [/\.test\.(js|ts|py|rs|go)$/, /\.spec\.(js|ts|py)$/, /_test\.(go|rs)$/];
    
    for (const dir of testDirs) {
      try {
        await fs.access(dir);
        const testFiles = await findTestFiles(dir, testPatterns);
        
        for (const file of testFiles) {
          const content = await fs.readFile(file, 'utf8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            // Look for test function definitions
            const testMatches = [
              line.match(/^\s*(test|it|describe)\s*\(\s*['"`]([^'"`]+)['"`]/), // Jest/Mocha
              line.match(/^\s*def\s+test_(\w+)/), // Python pytest
              line.match(/^\s*func\s+Test(\w+)/), // Go
              line.match(/^\s*#\[test\]\s*fn\s+(\w+)/) // Rust
            ].find(match => match);
            
            if (testMatches) {
              const testName = testMatches[2] || testMatches[1];
              tests.push({
                id: generateStableId('test', testName, { source: file }),
                name: testName,
                content: line.trim(),
                source: file,
                location: { file, line: index + 1 },
                type: 'test_function'
              });
            }
            
            // Look for TEST: markers
            const testMarker = line.match(/\/\/\s*TEST:\s*(.+)$/) || line.match(/#\s*TEST:\s*(.+)$/);
            if (testMarker) {
              const testContent = testMarker[1].trim();
              tests.push({
                id: generateStableId('test', testContent, { source: file, marker: true }),
                content: testContent,
                source: file,
                location: { file, line: index + 1 },
                type: 'test_marker'
              });
            }
          });
        }
      } catch (error) {
        // Directory not found, continue
      }
    }
    
  } catch (error) {
    console.warn(`⚠️ Error extracting tests: ${error.message}`);
  }
  
  return tests;
}

/**
 * Extract code artifacts with ARBITER markers
 */
async function extractCodeArtifacts() {
  const codeArtifacts = [];
  
  try {
    // Find source files
    const sourceDirs = ['src', 'lib', 'app', 'apps', 'packages'];
    const sourcePatterns = [/\.(js|ts|tsx|py|rs|go)$/];
    
    for (const dir of sourceDirs) {
      try {
        await fs.access(dir);
        const sourceFiles = await findSourceFiles(dir, sourcePatterns);
        
        for (const file of sourceFiles) {
          const content = await fs.readFile(file, 'utf8');
          const lines = content.split('\n');
          
          let inArbiterBlock = false;
          let blockStart = null;
          let blockContent = [];
          
          lines.forEach((line, index) => {
            // Look for ARBITER:BEGIN/END markers
            if (line.includes('ARBITER:BEGIN')) {
              inArbiterBlock = true;
              blockStart = index + 1;
              blockContent = [];
              
              const beginMatch = line.match(/ARBITER:BEGIN\s+(.+)$/);
              if (beginMatch) {
                const blockId = beginMatch[1].trim();
                codeArtifacts.push({
                  id: generateStableId('code', blockId, { source: file, start: index }),
                  name: blockId,
                  content: line.trim(),
                  source: file,
                  location: { file, line: index + 1, startLine: index + 1 },
                  type: 'arbiter_block_start'
                });
              }
            } else if (line.includes('ARBITER:END')) {
              if (inArbiterBlock && blockStart) {
                // Close the block
                const lastArtifact = codeArtifacts[codeArtifacts.length - 1];
                if (lastArtifact && lastArtifact.type === 'arbiter_block_start') {
                  lastArtifact.location.endLine = index + 1;
                  lastArtifact.blockContent = blockContent.join('\n');
                  lastArtifact.type = 'arbiter_block';
                }
              }
              inArbiterBlock = false;
              blockStart = null;
              blockContent = [];
            } else if (inArbiterBlock) {
              blockContent.push(line);
            }
            
            // Look for CODE: markers
            const codeMarker = line.match(/\/\/\s*CODE:\s*(.+)$/) || line.match(/#\s*CODE:\s*(.+)$/);
            if (codeMarker) {
              const codeContent = codeMarker[1].trim();
              codeArtifacts.push({
                id: generateStableId('code', codeContent, { source: file, marker: true }),
                content: codeContent,
                source: file,
                location: { file, line: index + 1 },
                type: 'code_marker'
              });
            }
          });
        }
      } catch (error) {
        // Directory not found, continue
      }
    }
    
  } catch (error) {
    console.warn(`⚠️ Error extracting code artifacts: ${error.message}`);
  }
  
  return codeArtifacts;
}

/**
 * Build traceability graph linking all artifacts
 */
function buildTraceabilityGraph(requirements, specifications, tests, codeArtifacts) {
  const graph = {
    nodes: [],
    links: [],
    coverage: {
      requirements: { total: requirements.length, linked: 0 },
      specifications: { total: specifications.length, linked: 0 },
      tests: { total: tests.length, linked: 0 },
      code: { total: codeArtifacts.length, linked: 0 }
    }
  };
  
  // Add all nodes
  graph.nodes.push(...requirements.map(r => ({ ...r, nodeType: 'requirement' })));
  graph.nodes.push(...specifications.map(s => ({ ...s, nodeType: 'specification' })));
  graph.nodes.push(...tests.map(t => ({ ...t, nodeType: 'test' })));
  graph.nodes.push(...codeArtifacts.map(c => ({ ...c, nodeType: 'code' })));
  
  // Build links using content similarity and explicit markers
  const allNodes = graph.nodes;
  
  for (const node1 of allNodes) {
    for (const node2 of allNodes) {
      if (node1.id === node2.id) continue;
      
      const linkStrength = calculateLinkStrength(node1, node2);
      if (linkStrength > 0.3) { // Threshold for meaningful links
        graph.links.push({
          source: node1.id,
          target: node2.id,
          strength: linkStrength,
          type: determineLinkType(node1, node2)
        });
        
        // Update coverage counters
        if (!node1.linked) {
          const coverageKey = node1.nodeType === 'code' ? 'code' : node1.nodeType + 's';
          graph.coverage[coverageKey].linked++;
          node1.linked = true;
        }
        if (!node2.linked) {
          const coverageKey = node2.nodeType === 'code' ? 'code' : node2.nodeType + 's';
          graph.coverage[coverageKey].linked++;
          node2.linked = true;
        }
      }
    }
  }
  
  return graph;
}

/**
 * Calculate link strength between two nodes based on content similarity
 */
function calculateLinkStrength(node1, node2) {
  // Explicit ID references get maximum strength
  if (node1.content.includes(node2.id) || node2.content.includes(node1.id)) {
    return 1.0;
  }
  
  // File co-location increases strength
  if (node1.source === node2.source) {
    return 0.8;
  }
  
  // Content similarity using simple word overlap
  const words1 = new Set(node1.content.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const words2 = new Set(node2.content.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  
  const similarity = intersection.size / union.size;
  
  // Boost similarity for certain node type combinations
  if ((node1.nodeType === 'requirement' && node2.nodeType === 'specification') ||
      (node1.nodeType === 'specification' && node2.nodeType === 'test') ||
      (node1.nodeType === 'test' && node2.nodeType === 'code')) {
    return similarity * 1.5;
  }
  
  return similarity;
}

/**
 * Determine the type of link between two nodes
 */
function determineLinkType(node1, node2) {
  const types = [node1.nodeType, node2.nodeType].sort();
  
  const linkTypes = {
    'requirement,specification': 'implements',
    'specification,test': 'verifies', 
    'test,code': 'validates',
    'requirement,test': 'tests',
    'specification,code': 'realizes',
    'requirement,code': 'fulfills'
  };
  
  return linkTypes[types.join(',')] || 'relates_to';
}

/**
 * Generate comprehensive TRACE.json report
 */
async function generateTraceReport(outputPath = 'TRACE.json') {
  console.log('🔗 Building traceability graph...');
  
  const requirements = await extractRequirements();
  const specifications = await extractSpecifications();
  const tests = await extractTests();
  const codeArtifacts = await extractCodeArtifacts();
  
  console.log(`Found: ${requirements.length} requirements, ${specifications.length} specs, ${tests.length} tests, ${codeArtifacts.length} code artifacts`);
  
  const graph = buildTraceabilityGraph(requirements, specifications, tests, codeArtifacts);
  
  const report = {
    apiVersion: 'arbiter.dev/v2',
    kind: 'TraceabilityReport',
    metadata: {
      generated: new Date().toISOString(),
      tool: 'arbiter',
      version: '0.1.0'
    },
    summary: {
      artifacts: {
        requirements: requirements.length,
        specifications: specifications.length,
        tests: tests.length,
        code: codeArtifacts.length,
        total: graph.nodes.length
      },
      links: {
        total: graph.links.length,
        strong: graph.links.filter(l => l.strength > 0.7).length,
        medium: graph.links.filter(l => l.strength > 0.4 && l.strength <= 0.7).length,
        weak: graph.links.filter(l => l.strength <= 0.4).length
      },
      coverage: graph.coverage
    },
    graph,
    gaps: findTraceabilityGaps(graph),
    recommendations: generateTraceabilityRecommendations(graph)
  };
  
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(`✅ Traceability report saved to: ${outputPath}`);
  
  return report;
}

/**
 * Find gaps in traceability coverage
 */
function findTraceabilityGaps(graph) {
  const gaps = [];
  
  // Find unlinked nodes
  const unlinkedNodes = graph.nodes.filter(node => !node.linked);
  
  unlinkedNodes.forEach(node => {
    gaps.push({
      type: 'orphan_artifact',
      artifact: node.id,
      nodeType: node.nodeType,
      description: `${node.nodeType} '${node.content}' has no traceability links`,
      location: node.location
    });
  });
  
  // Find missing downstream artifacts
  const requirements = graph.nodes.filter(n => n.nodeType === 'requirement');
  requirements.forEach(req => {
    const hasSpecs = graph.links.some(l => l.source === req.id && 
      graph.nodes.find(n => n.id === l.target)?.nodeType === 'specification');
    const hasTests = graph.links.some(l => l.source === req.id &&
      graph.nodes.find(n => n.id === l.target)?.nodeType === 'test');
    
    if (!hasSpecs) {
      gaps.push({
        type: 'missing_specification',
        artifact: req.id,
        description: `Requirement '${req.content}' has no implementing specification`,
        location: req.location
      });
    }
    
    if (!hasTests) {
      gaps.push({
        type: 'missing_tests',
        artifact: req.id,
        description: `Requirement '${req.content}' has no validating tests`,
        location: req.location
      });
    }
  });
  
  return gaps;
}

/**
 * Generate recommendations for improving traceability
 */
function generateTraceabilityRecommendations(graph) {
  const recommendations = [];
  
  // Coverage recommendations
  Object.entries(graph.coverage).forEach(([type, stats]) => {
    const coveragePercent = stats.total > 0 ? (stats.linked / stats.total) * 100 : 100;
    if (coveragePercent < 80) {
      recommendations.push({
        type: 'improve_coverage',
        category: type,
        description: `${type} traceability coverage is ${coveragePercent.toFixed(1)}% - consider adding explicit ID references or ARBITER markers`,
        priority: coveragePercent < 50 ? 'high' : 'medium'
      });
    }
  });
  
  // Link strength recommendations
  const weakLinks = graph.links.filter(l => l.strength < 0.5);
  if (weakLinks.length > graph.links.length * 0.3) {
    recommendations.push({
      type: 'strengthen_links',
      description: `${weakLinks.length} weak traceability links detected - consider adding explicit references between artifacts`,
      priority: 'medium'
    });
  }
  
  return recommendations;
}

/**
 * Helper function to find CUE files recursively
 */
async function findCueFiles(dir) {
  return await findFilesRecursive(dir, /\.cue$/);
}

/**
 * Helper function to find test files
 */
async function findTestFiles(dir, patterns) {
  const files = await findFilesRecursive(dir, () => true);
  return files.filter(file => patterns.some(pattern => pattern.test(file)));
}

/**
 * Helper function to find source files  
 */
async function findSourceFiles(dir, patterns) {
  const files = await findFilesRecursive(dir, () => true);
  return files.filter(file => patterns.some(pattern => pattern.test(file)));
}

/**
 * Helper function to find files recursively
 */
async function findFilesRecursive(dir, filter) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!['node_modules', 'target', 'build', 'dist', '.git'].includes(entry.name)) {
          const subFiles = await findFilesRecursive(fullPath, filter);
          files.push(...subFiles);
        }
      } else if (entry.isFile() && filter(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory access denied, skip
  }
  
  return files;
}

module.exports = {
  generateStableId,
  extractRequirements,
  extractSpecifications,
  extractTests,
  extractCodeArtifacts,
  buildTraceabilityGraph,
  generateTraceReport
};