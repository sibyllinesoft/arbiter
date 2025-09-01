/**
 * Language-specific parsing functions for API surface extraction
 * Using regex-based parsing with language-specific patterns
 */

const fs = require('fs').promises;
const path = require('path');

// Parse Rust files for public items
async function parseRustFiles() {
  const files = await findFiles('./src', /\.rs$/);
  const items = [];
  const modules = [];
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const fileItems = parseRustContent(content, file);
      items.push(...fileItems.items);
      modules.push(...fileItems.modules);
    } catch (error) {
      console.log(`⚠️ Failed to parse ${file}: ${error.message}`);
    }
  }
  
  return { items, modules };
}

// Parse Rust file content
function parseRustContent(content, filePath) {
  const items = [];
  const modules = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith('//') || line === '') continue;
    
    // Parse public functions
    const pubFn = line.match(/^pub\s+(?:async\s+)?fn\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?\s*[{;]/);
    if (pubFn) {
      items.push({
        name: pubFn[1],
        kind: 'function',
        visibility: 'pub',
        signature: line,
        parameters: pubFn[2].trim(),
        return_type: pubFn[3]?.trim(),
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse public structs
    const pubStruct = line.match(/^pub\s+struct\s+(\w+)/);
    if (pubStruct) {
      items.push({
        name: pubStruct[1],
        kind: 'struct',
        visibility: 'pub',
        signature: line,
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse public enums
    const pubEnum = line.match(/^pub\s+enum\s+(\w+)/);
    if (pubEnum) {
      items.push({
        name: pubEnum[1],
        kind: 'enum',
        visibility: 'pub',
        signature: line,
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse public traits
    const pubTrait = line.match(/^pub\s+trait\s+(\w+)/);
    if (pubTrait) {
      items.push({
        name: pubTrait[1],
        kind: 'trait',
        visibility: 'pub',
        signature: line,
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse public constants
    const pubConst = line.match(/^pub\s+const\s+(\w+)\s*:\s*([^=]+)/);
    if (pubConst) {
      items.push({
        name: pubConst[1],
        kind: 'constant',
        visibility: 'pub',
        signature: line,
        type: pubConst[2].trim(),
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse public modules
    const pubMod = line.match(/^pub\s+mod\s+(\w+)/);
    if (pubMod) {
      modules.push({
        name: pubMod[1],
        kind: 'module',
        visibility: 'pub',
        location: { file: filePath, line: i + 1 }
      });
    }
  }
  
  return { items, modules };
}

// Parse TypeScript files
async function parseTypeScriptFiles(files) {
  const items = [];
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const fileItems = parseTypeScriptContent(content, file);
      items.push(...fileItems);
    } catch (error) {
      console.log(`⚠️ Failed to parse ${file}: ${error.message}`);
    }
  }
  
  return items;
}

// Parse TypeScript content
function parseTypeScriptContent(content, filePath) {
  const items = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith('//') || line.startsWith('/*') || line === '') continue;
    
    // Parse exported functions
    const exportFn = line.match(/^export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*[{;]/);
    if (exportFn) {
      items.push({
        name: exportFn[1],
        kind: 'function',
        visibility: 'export',
        signature: line,
        parameters: exportFn[2].trim(),
        return_type: exportFn[3]?.trim(),
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse exported interfaces
    const exportInterface = line.match(/^export\s+interface\s+(\w+)/);
    if (exportInterface) {
      items.push({
        name: exportInterface[1],
        kind: 'interface',
        visibility: 'export',
        signature: line,
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse exported types
    const exportType = line.match(/^export\s+type\s+(\w+)/);
    if (exportType) {
      items.push({
        name: exportType[1],
        kind: 'type',
        visibility: 'export',
        signature: line,
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse exported classes
    const exportClass = line.match(/^export\s+class\s+(\w+)/);
    if (exportClass) {
      items.push({
        name: exportClass[1],
        kind: 'class',
        visibility: 'export',
        signature: line,
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse exported constants/variables
    const exportConst = line.match(/^export\s+const\s+(\w+)/);
    if (exportConst) {
      items.push({
        name: exportConst[1],
        kind: 'constant',
        visibility: 'export',
        signature: line,
        location: { file: filePath, line: i + 1 }
      });
    }
  }
  
  return items;
}

// Parse .d.ts files
async function parseDtsFiles(files) {
  const items = [];
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const fileItems = parseTypeScriptContent(content, file);
      items.push(...fileItems);
    } catch (error) {
      console.log(`⚠️ Failed to parse ${file}: ${error.message}`);
    }
  }
  
  return items;
}

// Parse Python files
async function parsePythonFiles(files) {
  const items = [];
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const fileItems = parsePythonContent(content, file);
      items.push(...fileItems);
    } catch (error) {
      console.log(`⚠️ Failed to parse ${file}: ${error.message}`);
    }
  }
  
  return items;
}

// Parse Python content
function parsePythonContent(content, filePath) {
  const items = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith('#') || line === '') continue;
    
    // Parse functions (consider public if not starting with _)
    const func = line.match(/^def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/);
    if (func && !func[1].startsWith('_')) {
      items.push({
        name: func[1],
        kind: 'function',
        visibility: 'public',
        signature: line,
        parameters: func[2].trim(),
        return_type: func[3]?.trim(),
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse classes (consider public if not starting with _)
    const cls = line.match(/^class\s+(\w+)(?:\(([^)]*)\))?\s*:/);
    if (cls && !cls[1].startsWith('_')) {
      items.push({
        name: cls[1],
        kind: 'class',
        visibility: 'public',
        signature: line,
        base_classes: cls[2]?.trim(),
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse module-level variables (consider public if not starting with _)
    const var_assign = line.match(/^(\w+)\s*[:=]/);
    if (var_assign && !var_assign[1].startsWith('_') && var_assign[1] === var_assign[1].toUpperCase()) {
      items.push({
        name: var_assign[1],
        kind: 'constant',
        visibility: 'public',
        signature: line,
        location: { file: filePath, line: i + 1 }
      });
    }
  }
  
  return items;
}

// Parse Go files
async function parseGoFiles(files) {
  const items = [];
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const fileItems = parseGoContent(content, file);
      items.push(...fileItems);
    } catch (error) {
      console.log(`⚠️ Failed to parse ${file}: ${error.message}`);
    }
  }
  
  return items;
}

// Parse Go content
function parseGoContent(content, filePath) {
  const items = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith('//') || line === '') continue;
    
    // Parse functions (public if starts with uppercase)
    const func = line.match(/^func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*([^{]+))?\s*[{]/);
    if (func && /^[A-Z]/.test(func[1])) {
      items.push({
        name: func[1],
        kind: 'function',
        visibility: 'public',
        signature: line,
        parameters: func[2].trim(),
        return_type: func[3]?.trim(),
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse types (public if starts with uppercase)
    const type_def = line.match(/^type\s+(\w+)\s+(.+)/);
    if (type_def && /^[A-Z]/.test(type_def[1])) {
      items.push({
        name: type_def[1],
        kind: 'type',
        visibility: 'public',
        signature: line,
        definition: type_def[2].trim(),
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse constants (public if starts with uppercase)
    const const_def = line.match(/^const\s+(\w+)/);
    if (const_def && /^[A-Z]/.test(const_def[1])) {
      items.push({
        name: const_def[1],
        kind: 'constant',
        visibility: 'public',
        signature: line,
        location: { file: filePath, line: i + 1 }
      });
    }
    
    // Parse variables (public if starts with uppercase)
    const var_def = line.match(/^var\s+(\w+)/);
    if (var_def && /^[A-Z]/.test(var_def[1])) {
      items.push({
        name: var_def[1],
        kind: 'variable',
        visibility: 'public',
        signature: line,
        location: { file: filePath, line: i + 1 }
      });
    }
  }
  
  return items;
}

// Parse Bash files
async function parseBashFiles(files) {
  const functions = [];
  const scripts = [];
  
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const fileItems = parseBashContent(content, file);
      functions.push(...fileItems.functions);
      scripts.push({
        name: path.basename(file),
        path: file,
        functions: fileItems.functions.length,
        executable: fileItems.executable
      });
    } catch (error) {
      console.log(`⚠️ Failed to parse ${file}: ${error.message}`);
    }
  }
  
  return { functions, scripts };
}

// Parse Bash content
function parseBashContent(content, filePath) {
  const functions = [];
  const lines = content.split('\n');
  let executable = false;
  
  // Check if file is executable (has shebang)
  if (lines[0] && lines[0].startsWith('#!')) {
    executable = true;
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip comments and empty lines (except shebang)
    if ((line.startsWith('#') && !line.startsWith('#!')) || line === '') continue;
    
    // Parse function definitions
    const func = line.match(/^function\s+(\w+)\s*\(\s*\)\s*[{]?/) || line.match(/^(\w+)\s*\(\s*\)\s*[{]/);
    if (func) {
      functions.push({
        name: func[1],
        kind: 'function',
        visibility: 'public',
        signature: line,
        location: { file: filePath, line: i + 1 }
      });
    }
  }
  
  return { functions, executable };
}

// Parse Cargo.toml
async function parseCargoToml() {
  try {
    const content = await fs.readFile('Cargo.toml', 'utf-8');
    return parseTomlContent(content);
  } catch (error) {
    throw new Error(`Cannot read Cargo.toml: ${error.message}`);
  }
}

// Simple TOML parser for Cargo.toml
function parseTomlContent(content) {
  const result = {
    dependencies: [],
    features: []
  };
  
  const lines = content.split('\n');
  let currentSection = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Parse section headers
    const section = trimmed.match(/^\[([^\]]+)\]/);
    if (section) {
      currentSection = section[1];
      continue;
    }
    
    // Parse key-value pairs
    const keyValue = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (keyValue && currentSection) {
      const key = keyValue[1];
      const value = keyValue[2].replace(/['"]/g, '');
      
      if (currentSection === 'dependencies') {
        result.dependencies.push({
          name: key,
          version: value
        });
      } else if (currentSection === 'features') {
        result.features.push({
          name: key,
          dependencies: value.replace(/[[\]]/g, '').split(',').map(s => s.trim())
        });
      }
    }
  }
  
  return result;
}

// Parse rustdoc HTML output (fallback)
async function parseRustdocOutput() {
  // This would parse generated HTML docs - simplified for now
  return [];
}

// Extract items from Go packages using go list output
async function extractGoPackageItems(packages) {
  const items = [];
  
  // This would use go doc to extract detailed information
  // For now, return basic package info
  for (const pkg of packages) {
    if (pkg.Name && pkg.ImportPath) {
      items.push({
        name: pkg.Name,
        kind: 'package',
        visibility: 'public',
        import_path: pkg.ImportPath,
        location: { file: pkg.Dir }
      });
    }
  }
  
  return items;
}

// Helper function to find files (reuse from surface-extractors)
async function findFiles(dir, pattern) {
  const files = [];
  
  async function scan(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'target') {
          await scan(fullPath);
        } else if (entry.isFile() && pattern.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
  }
  
  await scan(dir);
  return files;
}

module.exports = {
  parseRustFiles,
  parseTypeScriptFiles,
  parseDtsFiles,
  parsePythonFiles,
  parseGoFiles,
  parseBashFiles,
  parseCargoToml
};