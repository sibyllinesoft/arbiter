#!/usr/bin/env node

/**
 * Quick test script for Tree-sitter surface extraction
 */

const { extractSurface } = require('./lib/treesitter-surface.cjs');

async function testExtraction() {
  console.log('🧪 Testing Tree-sitter surface extraction...\n');
  
  const languages = ['bash']; // Start with bash since we have bash files
  
  for (const language of languages) {
    console.log(`\n📋 Testing ${language} extraction:`);
    console.log('='.repeat(50));
    
    try {
      const result = await extractSurface(language, { verbose: true });
      
      console.log(`✅ Extraction completed:`);
      console.log(`   - Method: ${result.extraction_method}`);
      console.log(`   - Files processed: ${result.meta?.files_processed || 'N/A'}`);
      console.log(`   - Public items: ${result.public_items.length}`);
      console.log(`   - Extraction time: ${result.meta?.extraction_time_ms || 'N/A'}ms`);
      
      if (result.public_items.length > 0) {
        console.log('\n📄 Sample items:');
        result.public_items.slice(0, 3).forEach(item => {
          console.log(`   - ${item.kind}: ${item.name} (${item.location.file}:${item.location.line})`);
        });
      }
      
    } catch (error) {
      console.error(`❌ ${language} extraction failed:`, error.message);
    }
  }
}

if (require.main === module) {
  testExtraction().catch(console.error);
}