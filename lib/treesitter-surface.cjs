/**
 * Tree-sitter based API surface extraction
 * Single parser approach for all languages with consistent output format
 */

const fs = require('fs').promises;
const path = require('path');

// Tree-sitter parsers - we'll use a fallback approach if not available
let Parser, Languages;
try {
  Parser = require('tree-sitter');
  Languages = {
    rust: require('tree-sitter-rust'),
    typescript: require('tree-sitter-typescript').tsx, // TSX parser handles both TS and TSX
    javascript: require('tree-sitter-typescript').typescript, // For JS files
    python: require('tree-sitter-python'),
    go: require('tree-sitter-go'),
    bash: require('tree-sitter-bash')
  };
} catch (error) {
  console.warn('⚠️ Tree-sitter not available, falling back to regex parsing');
  Parser = null;
}

/**
 * Main surface extraction function using Tree-sitter
 */
async function extractSurface(language, options = {}) {
  const startTime = Date.now();
  
  if (!Parser) {
    return await fallbackToRegexExtraction(language, options);
  }
  
  const surface = {
    language,
    timestamp: new Date().toISOString(),
    extraction_method: 'tree-sitter',
    public_items: [],
    modules: [],
    meta: {
      files_processed: 0,
      extraction_time_ms: 0
    }
  };
  
  try {
    const files = await findSourceFiles(language);
    const parser = new Parser();
    const langGrammar = Languages[language];
    
    if (!langGrammar) {
      throw new Error(`Tree-sitter grammar not available for ${language}`);
    }
    
    parser.setLanguage(langGrammar);
    
    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const tree = parser.parse(content);
        const fileItems = await extractFromTree(tree, filePath, language, content);
        
        surface.public_items.push(...fileItems.public_items);
        surface.modules.push(...fileItems.modules);
        surface.meta.files_processed++;
        
      } catch (fileError) {
        console.warn(`⚠️ Failed to parse ${filePath}: ${fileError.message}`);
      }
    }
    
    surface.meta.extraction_time_ms = Date.now() - startTime;
    
    // Post-process to remove duplicates and sort
    surface.public_items = deduplicateItems(surface.public_items);
    surface.modules = [...new Set(surface.modules)];
    
    console.log(`✅ Tree-sitter extracted ${surface.public_items.length} items from ${surface.meta.files_processed} files in ${surface.meta.extraction_time_ms}ms`);
    
    return surface;
    
  } catch (error) {
    console.warn(`⚠️ Tree-sitter extraction failed: ${error.message}`);
    return await fallbackToRegexExtraction(language, options);
  }
}

/**
 * Extract public items from Tree-sitter AST
 */
async function extractFromTree(tree, filePath, language, sourceContent) {
  const public_items = [];
  const modules = [];
  const lines = sourceContent.split('\n');
  
  // Language-specific queries
  const queries = getLanguageQueries(language);
  
  for (const queryInfo of queries) {
    const query = Languages[language].query(queryInfo.pattern);
    const captures = query.captures(tree.rootNode);
    
    for (const capture of captures) {
      const node = capture.node;
      const name = getNodeText(node, sourceContent, queryInfo.nameCapture);
      
      if (name && shouldIncludeItem(node, sourceContent, language)) {
        const item = {
          name,
          kind: queryInfo.kind,
          visibility: getVisibility(node, sourceContent, language),
          signature: getSignature(node, sourceContent),
          location: {
            file: filePath,
            line: node.startPosition.row + 1,
            column: node.startPosition.column + 1
          }
        };
        
        // Add language-specific metadata
        addLanguageSpecificMetadata(item, node, sourceContent, language);
        public_items.push(item);
      }
    }
  }
  
  return { public_items, modules };
}

/**
 * Language-specific Tree-sitter queries
 */
function getLanguageQueries(language) {
  const queries = {
    rust: [
      {
        pattern: `
          (function_item 
            visibility: (visibility_modifier)? @vis
            name: (identifier) @name
          ) @function
        `,
        kind: 'function',
        nameCapture: 'name'
      },
      {
        pattern: `
          (struct_item 
            visibility: (visibility_modifier)? @vis
            name: (type_identifier) @name
          ) @struct
        `,
        kind: 'struct',
        nameCapture: 'name'
      },
      {
        pattern: `
          (enum_item 
            visibility: (visibility_modifier)? @vis
            name: (type_identifier) @name
          ) @enum
        `,
        kind: 'enum',
        nameCapture: 'name'
      },
      {
        pattern: `
          (trait_item 
            visibility: (visibility_modifier)? @vis
            name: (type_identifier) @name
          ) @trait
        `,
        kind: 'trait',
        nameCapture: 'name'
      },
      {
        pattern: `
          (impl_item 
            trait: (type_identifier)? @trait_name
            type: (type_identifier) @type_name
          ) @impl
        `,
        kind: 'impl',
        nameCapture: 'type_name'
      }
    ],
    
    typescript: [
      {
        pattern: `
          (export_statement 
            (function_declaration 
              name: (identifier) @name
            )
          ) @function
        `,
        kind: 'function',
        nameCapture: 'name'
      },
      {
        pattern: `
          (export_statement 
            (class_declaration 
              name: (type_identifier) @name
            )
          ) @class
        `,
        kind: 'class',
        nameCapture: 'name'
      },
      {
        pattern: `
          (export_statement 
            (interface_declaration 
              name: (type_identifier) @name
            )
          ) @interface
        `,
        kind: 'interface',
        nameCapture: 'name'
      },
      {
        pattern: `
          (export_statement 
            (type_alias_declaration 
              name: (type_identifier) @name
            )
          ) @type
        `,
        kind: 'type',
        nameCapture: 'name'
      },
      {
        pattern: `
          (export_statement 
            (variable_declaration 
              (variable_declarator 
                name: (identifier) @name
              )
            )
          ) @variable
        `,
        kind: 'variable',
        nameCapture: 'name'
      }
    ],
    
    python: [
      {
        pattern: `
          (function_definition 
            name: (identifier) @name
          ) @function
        `,
        kind: 'function',
        nameCapture: 'name'
      },
      {
        pattern: `
          (class_definition 
            name: (identifier) @name
          ) @class
        `,
        kind: 'class',
        nameCapture: 'name'
      },
      {
        pattern: `
          (assignment 
            left: (identifier) @name
          ) @variable
        `,
        kind: 'variable',
        nameCapture: 'name'
      }
    ],
    
    go: [
      {
        pattern: `
          (function_declaration 
            name: (identifier) @name
          ) @function
        `,
        kind: 'function',
        nameCapture: 'name'
      },
      {
        pattern: `
          (method_declaration 
            name: (field_identifier) @name
          ) @method
        `,
        kind: 'method',
        nameCapture: 'name'
      },
      {
        pattern: `
          (type_declaration 
            (type_spec 
              name: (type_identifier) @name
            )
          ) @type
        `,
        kind: 'type',
        nameCapture: 'name'
      },
      {
        pattern: `
          (var_declaration 
            (var_spec 
              name: (identifier) @name
            )
          ) @variable
        `,
        kind: 'variable',
        nameCapture: 'name'
      }
    ],
    
    bash: [
      {
        pattern: `
          (function_definition 
            name: (word) @name
          ) @function
        `,
        kind: 'function',
        nameCapture: 'name'
      },
      {
        pattern: `
          (variable_assignment 
            name: (variable_name) @name
          ) @variable
        `,
        kind: 'variable',
        nameCapture: 'name'
      }
    ]
  };
  
  return queries[language] || [];
}

/**
 * Helper functions
 */
function getNodeText(node, sourceContent, captureType) {
  if (!node) return null;
  return sourceContent.slice(node.startIndex, node.endIndex);
}

function shouldIncludeItem(node, sourceContent, language) {
  const text = sourceContent.slice(node.startIndex, node.endIndex);
  
  switch (language) {
    case 'rust':
      // Include if it has pub visibility or is a trait impl
      return text.includes('pub ') || text.includes('impl ');
    case 'typescript':
      // Include if it's exported
      return text.includes('export ');
    case 'python':
      // Include if it doesn't start with underscore (not private by convention)
      const name = getNodeText(node, sourceContent);
      return name && !name.startsWith('_');
    case 'go':
      // Include if first letter is uppercase (Go public convention)
      const goName = getNodeText(node, sourceContent);
      return goName && goName[0] === goName[0].toUpperCase();
    case 'bash':
      // Include all functions (bash doesn't have visibility modifiers)
      return true;
    default:
      return true;
  }
}

function getVisibility(node, sourceContent, language) {
  const text = sourceContent.slice(node.startIndex, node.endIndex);
  
  switch (language) {
    case 'rust':
      if (text.includes('pub(crate)')) return 'pub(crate)';
      if (text.includes('pub ')) return 'pub';
      return 'private';
    case 'typescript':
      if (text.includes('export ')) return 'public';
      return 'private';
    case 'python':
      const name = getNodeText(node, sourceContent);
      if (name?.startsWith('__')) return 'private';
      if (name?.startsWith('_')) return 'protected';
      return 'public';
    case 'go':
      const goName = getNodeText(node, sourceContent);
      return goName && goName[0] === goName[0].toUpperCase() ? 'public' : 'private';
    default:
      return 'public';
  }
}

function getSignature(node, sourceContent) {
  const text = sourceContent.slice(node.startIndex, node.endIndex);
  // Return first line of the node as signature
  return text.split('\n')[0].trim();
}

function addLanguageSpecificMetadata(item, node, sourceContent, language) {
  switch (language) {
    case 'rust':
      // Add async/const information
      if (item.signature.includes('async ')) item.is_async = true;
      if (item.signature.includes('const ')) item.is_const = true;
      break;
    case 'typescript':
      // Add generic information
      if (item.signature.includes('<') && item.signature.includes('>')) {
        item.has_generics = true;
      }
      break;
  }
}

/**
 * Find source files for a given language
 */
async function findSourceFiles(language) {
  const patterns = {
    rust: /\.(rs)$/,
    typescript: /\.(ts|tsx)$/,
    javascript: /\.(js|jsx)$/,
    python: /\.(py)$/,
    go: /\.(go)$/,
    bash: /\.(sh|bash)$/
  };
  
  const pattern = patterns[language];
  if (!pattern) return [];
  
  const files = [];
  const startDirs = language === 'rust' ? ['src'] : language === 'go' ? ['.'] : ['src', 'lib', '.'];
  
  for (const startDir of startDirs) {
    try {
      await fs.access(startDir);
      const dirFiles = await findFilesRecursive(startDir, pattern);
      files.push(...dirFiles);
    } catch (error) {
      // Directory doesn't exist, skip
    }
  }
  
  return [...new Set(files)]; // Remove duplicates
}

/**
 * Recursively find files matching pattern
 */
async function findFilesRecursive(dir, pattern) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip common ignore directories
        if (['node_modules', 'target', 'build', 'dist', '.git', '__pycache__'].includes(entry.name)) {
          continue;
        }
        const subFiles = await findFilesRecursive(fullPath, pattern);
        files.push(...subFiles);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory access denied, skip
  }
  
  return files;
}

/**
 * Remove duplicate items based on name and location
 */
function deduplicateItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.name}:${item.kind}:${item.location.file}:${item.location.line}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Fallback to regex-based extraction if Tree-sitter fails
 */
async function fallbackToRegexExtraction(language, options) {
  console.log(`🔄 Falling back to regex extraction for ${language}`);
  
  // Import the existing regex-based extractors
  const { extractApiSurface } = require('./surface-extractors.cjs');
  return await extractApiSurface(language, options);
}

/**
 * Compute API surface delta between two surfaces
 */
function computeSurfaceDelta(oldSurface, newSurface) {
  const oldItems = new Map(oldSurface.public_items.map(item => [`${item.name}:${item.kind}`, item]));
  const newItems = new Map(newSurface.public_items.map(item => [`${item.name}:${item.kind}`, item]));
  
  const added = [];
  const removed = [];
  const modified = [];
  
  // Find added items
  for (const [key, item] of newItems) {
    if (!oldItems.has(key)) {
      added.push(item);
    }
  }
  
  // Find removed items
  for (const [key, item] of oldItems) {
    if (!newItems.has(key)) {
      removed.push(item);
    }
  }
  
  // Find modified items (signature changes)
  for (const [key, newItem] of newItems) {
    const oldItem = oldItems.get(key);
    if (oldItem && oldItem.signature !== newItem.signature) {
      modified.push({
        name: newItem.name,
        kind: newItem.kind,
        old_signature: oldItem.signature,
        new_signature: newItem.signature,
        change_type: determineChangeType(oldItem, newItem)
      });
    }
  }
  
  // Determine required version bump
  const required_bump = determineRequiredBump({ added, removed, modified });
  
  return {
    added,
    removed,
    modified,
    summary: {
      added_count: added.length,
      removed_count: removed.length,
      modified_count: modified.length,
      total_changes: added.length + removed.length + modified.length
    },
    required_bump,
    breaking_changes: [...removed, ...modified.filter(m => m.change_type === 'breaking')]
  };
}

/**
 * Determine if a signature change is breaking
 */
function determineChangeType(oldItem, newItem) {
  // Simple heuristics for breaking changes
  
  // Parameter changes are usually breaking
  if (oldItem.kind === 'function' || oldItem.kind === 'method') {
    const oldParams = extractParameters(oldItem.signature);
    const newParams = extractParameters(newItem.signature);
    
    if (oldParams.length !== newParams.length) {
      return 'breaking';
    }
  }
  
  // Visibility changes
  if (oldItem.visibility === 'public' && newItem.visibility !== 'public') {
    return 'breaking';
  }
  
  // Return type changes (for typed languages)
  if (oldItem.signature !== newItem.signature && 
      (oldItem.signature.includes('->') || oldItem.signature.includes(':'))) {
    return 'breaking';
  }
  
  return 'non-breaking';
}

/**
 * Extract parameters from function signature (simple approach)
 */
function extractParameters(signature) {
  const match = signature.match(/\(([^)]*)\)/);
  if (!match) return [];
  
  return match[1].split(',').map(p => p.trim()).filter(p => p);
}

/**
 * Determine required semantic version bump
 */
function determineRequiredBump({ added, removed, modified }) {
  const breakingChanges = [
    ...removed,
    ...modified.filter(m => m.change_type === 'breaking')
  ];
  
  if (breakingChanges.length > 0) {
    return 'MAJOR';
  } else if (added.length > 0) {
    return 'MINOR';
  } else if (modified.length > 0) {
    return 'PATCH';
  } else {
    return 'NONE';
  }
}

module.exports = {
  extractSurface,
  computeSurfaceDelta,
  determineRequiredBump
};