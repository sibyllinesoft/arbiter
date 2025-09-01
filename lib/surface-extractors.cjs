/**
 * Multi-language API surface extractors
 * Pragmatic approach using regex and language-specific tools where available
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Main extraction function with fallback strategies
async function extractApiSurface(language, options = {}) {
  const extractor = getExtractor(language);
  if (!extractor) {
    throw new Error(`Unsupported language: ${language}`);
  }
  
  return await extractor(options);
}

// Get appropriate extractor for language
function getExtractor(language) {
  const extractors = {
    'rust': extractRustSurface,
    'rs': extractRustSurface,
    'typescript': extractTypeScriptSurface, 
    'ts': extractTypeScriptSurface,
    'python': extractPythonSurface,
    'py': extractPythonSurface,
    'go': extractGoSurface,
    'bash': extractBashSurface,
    'sh': extractBashSurface
  };
  
  return extractors[language.toLowerCase()];
}

// Rust surface extraction with multiple strategies
async function extractRustSurface(options = {}) {
  console.log('🦀 Extracting Rust API surface...');
  
  const surface = {
    language: 'rust',
    timestamp: new Date().toISOString(),
    extraction_method: null,
    public_items: [],
    modules: [],
    feature_flags: [],
    dependencies: []
  };
  
  try {
    // Strategy 1: Try rustdoc (corrected command)
    try {
      console.log('Attempting rustdoc...');
      const rustdocResult = await runCommand('cargo', ['doc', '--no-deps'], {
        timeout: 30000
      });
      
      // Parse generated docs
      const docItems = await parseRustdocOutput();
      if (docItems.length > 0) {
        surface.extraction_method = 'rustdoc';
        surface.public_items = docItems;
        console.log('✅ Using rustdoc');
        return surface;
      }
    } catch (error) {
      console.log(`⚠️ rustdoc failed: ${error.message}`);
    }
    
    // Strategy 2: Basic file parsing
    console.log('Falling back to file parsing...');
    const fileItems = await parseRustFiles();
    surface.extraction_method = 'file_parsing';
    surface.public_items = fileItems.items;
    surface.modules = fileItems.modules;
    
    // Try to parse Cargo.toml
    try {
      const cargoData = await parseCargoToml();
      surface.dependencies = cargoData.dependencies;
      surface.feature_flags = cargoData.features;
    } catch (error) {
      console.log(`⚠️ Could not parse Cargo.toml: ${error.message}`);
    }
    
    console.log(`✅ Found ${surface.public_items.length} public items`);
    return surface;
    
  } catch (error) {
    throw new Error(`Rust surface extraction failed: ${error.message}`);
  }
}

// TypeScript surface extraction
async function extractTypeScriptSurface(options = {}) {
  console.log('🔷 Extracting TypeScript API surface...');
  
  const surface = {
    language: 'typescript',
    timestamp: new Date().toISOString(),
    extraction_method: null,
    public_items: [],
    modules: [],
    types: []
  };
  
  try {
    // Strategy 1: Try tsc --listFiles and parse .d.ts files
    try {
      console.log('Attempting TypeScript compiler...');
      await runCommand('tsc', ['--noEmit', '--listFiles'], { timeout: 15000 });
      
      // Find .d.ts files
      const dtsFiles = await findFiles('.', /\.d\.ts$/);
      const items = await parseDtsFiles(dtsFiles);
      
      if (items.length > 0) {
        surface.extraction_method = 'typescript_compiler';
        surface.public_items = items;
        console.log('✅ Using TypeScript compiler');
        return surface;
      }
    } catch (error) {
      console.log(`⚠️ TypeScript compiler failed: ${error.message}`);
    }
    
    // Strategy 2: Parse .ts files directly
    console.log('Falling back to file parsing...');
    const tsFiles = await findFiles('./src', /\.(ts|tsx)$/);
    const items = await parseTypeScriptFiles(tsFiles);
    
    surface.extraction_method = 'file_parsing';
    surface.public_items = items;
    
    console.log(`✅ Found ${surface.public_items.length} public items`);
    return surface;
    
  } catch (error) {
    throw new Error(`TypeScript surface extraction failed: ${error.message}`);
  }
}

// Python surface extraction  
async function extractPythonSurface(options = {}) {
  console.log('🐍 Extracting Python API surface...');
  
  const surface = {
    language: 'python',
    timestamp: new Date().toISOString(),
    extraction_method: 'file_parsing',
    public_items: [],
    modules: []
  };
  
  try {
    const pyFiles = await findFiles('.', /\.py$/);
    const items = await parsePythonFiles(pyFiles);
    
    surface.public_items = items;
    console.log(`✅ Found ${surface.public_items.length} public items`);
    return surface;
    
  } catch (error) {
    throw new Error(`Python surface extraction failed: ${error.message}`);
  }
}

// Go surface extraction
async function extractGoSurface(options = {}) {
  console.log('🔵 Extracting Go API surface...');
  
  const surface = {
    language: 'go',
    timestamp: new Date().toISOString(),
    extraction_method: null,
    public_items: [],
    packages: []
  };
  
  try {
    // Strategy 1: Try go list + go doc
    try {
      console.log('Attempting go list...');
      const listResult = await runCommand('go', ['list', '-json', './...'], {
        timeout: 15000
      });
      
      const packages = JSON.parse(`[${listResult.trim().split('\n').join(',')}]`);
      const items = await extractGoPackageItems(packages);
      
      if (items.length > 0) {
        surface.extraction_method = 'go_tools';
        surface.public_items = items;
        surface.packages = packages.map(p => p.ImportPath);
        console.log('✅ Using go tools');
        return surface;
      }
    } catch (error) {
      console.log(`⚠️ go tools failed: ${error.message}`);
    }
    
    // Strategy 2: Parse .go files
    console.log('Falling back to file parsing...');
    const goFiles = await findFiles('.', /\.go$/);
    const items = await parseGoFiles(goFiles);
    
    surface.extraction_method = 'file_parsing';
    surface.public_items = items;
    
    console.log(`✅ Found ${surface.public_items.length} public items`);
    return surface;
    
  } catch (error) {
    throw new Error(`Go surface extraction failed: ${error.message}`);
  }
}

// Bash surface extraction
async function extractBashSurface(options = {}) {
  console.log('🐚 Extracting Bash API surface...');
  
  const surface = {
    language: 'bash',
    timestamp: new Date().toISOString(),
    extraction_method: 'file_parsing',
    public_items: [],
    scripts: []
  };
  
  try {
    const bashFiles = await findFiles('.', /\.(sh|bash)$/);
    const items = await parseBashFiles(bashFiles);
    
    surface.public_items = items.functions;
    surface.scripts = items.scripts;
    
    console.log(`✅ Found ${surface.public_items.length} functions in ${surface.scripts.length} scripts`);
    return surface;
    
  } catch (error) {
    throw new Error(`Bash surface extraction failed: ${error.message}`);
  }
}

// Helper function to run commands with timeout
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      ...options
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timeout = options.timeout || 10000;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
    
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

// Helper function to find files matching pattern
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

// Import parsing functions
const {
  parseRustFiles,
  parseTypeScriptFiles,
  parseDtsFiles,
  parsePythonFiles,
  parseGoFiles,
  parseBashFiles,
  parseCargoToml
} = require('./surface-parsers.cjs');

module.exports = {
  extractApiSurface,
  extractRustSurface,
  extractTypeScriptSurface,
  extractPythonSurface,
  extractGoSurface,
  extractBashSurface
};