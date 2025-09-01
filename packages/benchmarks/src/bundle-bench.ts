import { spawn } from 'bun';
import { performance } from 'perf_hooks';
import type { BenchmarkResult } from './types';

export async function bundleBenchmark(): Promise<BenchmarkResult> {
  const startTime = Date.now();
  
  console.log('📦 Analyzing bundle sizes and build performance...');

  const results = {
    web_bundle_size: 0,
    api_bundle_size: 0,
    shared_bundle_size: 0,
    build_time: 0,
    chunk_count: 0,
    asset_count: 0,
    compression_ratio: 0,
  };

  try {
    // Build all packages and measure time
    const buildStart = performance.now();
    
    console.log('  🔨 Building all packages...');
    const buildProc = spawn(['bun', 'run', 'build'], {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await buildProc.exited;
    
    if (buildProc.exitCode !== 0) {
      const stderr = await new Response(buildProc.stderr).text();
      throw new Error(`Build failed: ${stderr}`);
    }

    results.build_time = performance.now() - buildStart;
    console.log(`  ⏱️  Build completed in ${Math.round(results.build_time)}ms`);

    // Analyze web bundle
    const webDistPath = './apps/web/dist';
    if (await Bun.file(`${webDistPath}/assets`).exists()) {
      const webStats = await analyzeBundleDirectory(`${webDistPath}/assets`);
      results.web_bundle_size = webStats.totalSize;
      results.chunk_count += webStats.fileCount;
      console.log(`  📱 Web bundle: ${Math.round(webStats.totalSize / 1024)}KB (${webStats.fileCount} files)`);
    }

    // Analyze API bundle (if built)
    const apiDistPath = './apps/api/dist';
    if (await Bun.file(apiDistPath).exists()) {
      const apiStats = await analyzeBundleDirectory(apiDistPath);
      results.api_bundle_size = apiStats.totalSize;
      results.asset_count += apiStats.fileCount;
      console.log(`  🚀 API bundle: ${Math.round(apiStats.totalSize / 1024)}KB (${apiStats.fileCount} files)`);
    }

    // Analyze shared package (if built)
    const sharedDistPath = './packages/shared/dist';
    if (await Bun.file(sharedDistPath).exists()) {
      const sharedStats = await analyzeBundleDirectory(sharedDistPath);
      results.shared_bundle_size = sharedStats.totalSize;
      console.log(`  📚 Shared bundle: ${Math.round(sharedStats.totalSize / 1024)}KB (${sharedStats.fileCount} files)`);
    }

    // Calculate compression ratio if gzipped files exist
    const totalUncompressed = results.web_bundle_size + results.api_bundle_size + results.shared_bundle_size;
    const gzipSizes = await analyzeCompressionRatio();
    results.compression_ratio = gzipSizes.totalCompressed > 0 ? 
      (totalUncompressed / gzipSizes.totalCompressed) : 1;

  } catch (error) {
    console.error('  ❌ Bundle analysis failed:', error);
    throw error;
  }

  const totalDuration = Date.now() - startTime;
  const totalBundleSize = results.web_bundle_size + results.api_bundle_size + results.shared_bundle_size;

  console.log(`  📊 Total bundle size: ${Math.round(totalBundleSize / 1024)}KB`);
  console.log(`  🗜️  Compression ratio: ${Math.round(results.compression_ratio * 100) / 100}x`);

  return {
    name: 'Bundle Size & Build Performance Benchmark',
    type: 'bundle',
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    metrics: {
      total_bundle_size_kb: Math.round(totalBundleSize / 1024 * 100) / 100,
      web_bundle_size_kb: Math.round(results.web_bundle_size / 1024 * 100) / 100,
      api_bundle_size_kb: Math.round(results.api_bundle_size / 1024 * 100) / 100,
      shared_bundle_size_kb: Math.round(results.shared_bundle_size / 1024 * 100) / 100,
      build_time_ms: Math.round(results.build_time * 100) / 100,
      chunk_count: results.chunk_count,
      asset_count: results.asset_count,
      compression_ratio: Math.round(results.compression_ratio * 100) / 100,
      build_speed_kb_per_ms: Math.round((totalBundleSize / results.build_time) * 100) / 100,
    },
    metadata: {
      analysis_timestamp: new Date().toISOString(),
      bundle_breakdown: {
        web: results.web_bundle_size,
        api: results.api_bundle_size,
        shared: results.shared_bundle_size,
      },
    },
  };
}

async function analyzeBundleDirectory(path: string): Promise<{ totalSize: number; fileCount: number }> {
  let totalSize = 0;
  let fileCount = 0;

  try {
    const proc = spawn(['find', path, '-type', 'f', '-exec', 'stat', '-c', '%s', '{}', ';'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await proc.exited;

    if (proc.exitCode === 0) {
      const output = await new Response(proc.stdout).text();
      const sizes = output.trim().split('\\n').filter(line => line.trim());
      
      for (const sizeStr of sizes) {
        const size = parseInt(sizeStr.trim(), 10);
        if (!isNaN(size)) {
          totalSize += size;
          fileCount++;
        }
      }
    }
  } catch (error) {
    // Fallback: try to get directory size
    try {
      const duProc = spawn(['du', '-sb', path], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      await duProc.exited;
      
      if (duProc.exitCode === 0) {
        const output = await new Response(duProc.stdout).text();
        const match = output.match(/^(\\d+)/);
        if (match) {
          totalSize = parseInt(match[1], 10);
          fileCount = 1; // Approximate
        }
      }
    } catch {
      // If all else fails, return 0
    }
  }

  return { totalSize, fileCount };
}

async function analyzeCompressionRatio(): Promise<{ totalCompressed: number; totalUncompressed: number }> {
  let totalCompressed = 0;
  let totalUncompressed = 0;

  const paths = [
    './apps/web/dist',
    './apps/api/dist', 
    './packages/shared/dist',
  ];

  for (const path of paths) {
    try {
      // Look for .gz files
      const gzProc = spawn(['find', path, '-name', '*.gz', '-exec', 'stat', '-c', '%s', '{}', ';'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      await gzProc.exited;

      if (gzProc.exitCode === 0) {
        const gzOutput = await new Response(gzProc.stdout).text();
        const gzSizes = gzOutput.trim().split('\\n').filter(line => line.trim());
        
        for (const sizeStr of gzSizes) {
          const size = parseInt(sizeStr.trim(), 10);
          if (!isNaN(size)) {
            totalCompressed += size;
          }
        }
      }

      // Look for corresponding uncompressed files
      const uncompressedProc = spawn(['find', path, '-type', 'f', '!', '-name', '*.gz', '-exec', 'stat', '-c', '%s', '{}', ';'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      await uncompressedProc.exited;

      if (uncompressedProc.exitCode === 0) {
        const uncompressedOutput = await new Response(uncompressedProc.stdout).text();
        const uncompressedSizes = uncompressedOutput.trim().split('\\n').filter(line => line.trim());
        
        for (const sizeStr of uncompressedSizes) {
          const size = parseInt(sizeStr.trim(), 10);
          if (!isNaN(size)) {
            totalUncompressed += size;
          }
        }
      }
    } catch (error) {
      // Continue with other paths
    }
  }

  return { totalCompressed, totalUncompressed };
}