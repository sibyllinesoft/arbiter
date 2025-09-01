import fs from 'fs-extra';
import path from 'path';
import { globalConstraintEnforcer, ConstraintViolationError } from './core.js';

/**
 * File system operation types that must be constrained
 */
export type FileSystemOperation = 
  | 'read'
  | 'write' 
  | 'copy'
  | 'move'
  | 'delete'
  | 'create'
  | 'bundle'
  | 'export';

/**
 * File system path validation result
 */
export interface PathValidationResult {
  isValid: boolean;
  resolvedPath: string;
  isSymlink: boolean;
  symlinkTarget?: string;
  securityIssues: string[];
}

/**
 * File system constraint enforcer
 * Implements "Don't emit symlinks" and "standalone/bundle copy files" constraints
 */
export class FileSystemConstraints {
  private readonly maxPathLength = 4096; // Maximum path length
  private readonly maxSymlinkDepth = 0; // No symlinks allowed per constraints
  private readonly allowedExtensions = new Set([
    '.cue', '.json', '.yaml', '.yml', '.md', '.txt', '.ts', '.js', '.py', '.rs', '.go'
  ]);

  /**
   * Validate a file path for constraint compliance
   */
  async validatePath(filePath: string, operation: FileSystemOperation, operationId?: string): Promise<PathValidationResult> {
    const result: PathValidationResult = {
      isValid: true,
      resolvedPath: '',
      isSymlink: false,
      securityIssues: [],
    };

    try {
      // Resolve the path to handle relative paths and symlinks
      const resolvedPath = path.resolve(filePath);
      result.resolvedPath = resolvedPath;

      // Check path length
      if (resolvedPath.length > this.maxPathLength) {
        result.isValid = false;
        result.securityIssues.push(`Path too long: ${resolvedPath.length} > ${this.maxPathLength}`);
      }

      // Check for path traversal attempts
      if (this.hasPathTraversal(resolvedPath)) {
        result.isValid = false;
        result.securityIssues.push('Path traversal detected');
      }

      // Check if path exists
      const exists = await fs.pathExists(resolvedPath);
      if (!exists && (operation === 'read' || operation === 'copy' || operation === 'move')) {
        result.isValid = false;
        result.securityIssues.push('Path does not exist');
      }

      if (exists) {
        // Check for symlinks (not allowed)
        const stats = await fs.lstat(resolvedPath);
        if (stats.isSymbolicLink()) {
          result.isSymlink = true;
          result.symlinkTarget = await fs.readlink(resolvedPath);
          
          // Symlinks are forbidden per constraint
          result.isValid = false;
          result.securityIssues.push('Symlinks are not allowed');
          
          const violation = new ConstraintViolationError(
            'symlinkPrevention',
            `symlink: ${filePath} -> ${result.symlinkTarget}`,
            'standalone file copy (no symlinks)',
            {
              operationId,
              operation,
              filePath,
              symlinkTarget: result.symlinkTarget,
              resolvedPath,
            }
          );

          globalConstraintEnforcer.emit('constraint:violation', {
            constraint: 'symlinkPrevention',
            violation,
            filePath,
          });

          throw violation;
        }

        // Check file extension for security
        const ext = path.extname(resolvedPath).toLowerCase();
        if (ext && !this.allowedExtensions.has(ext)) {
          result.securityIssues.push(`File extension ${ext} not allowed`);
        }
      }

      // Validate the result
      if (!result.isValid) {
        const violation = new ConstraintViolationError(
          'fileSystemValidation',
          `invalid path: ${filePath}`,
          'valid file system path',
          {
            operationId,
            operation,
            filePath,
            resolvedPath,
            securityIssues: result.securityIssues,
          }
        );

        globalConstraintEnforcer.emit('constraint:violation', {
          constraint: 'fileSystemValidation',
          violation,
          filePath,
        });

        throw violation;
      }

      globalConstraintEnforcer.emit('filesystem:validated', {
        operationId,
        operation,
        filePath,
        resolvedPath,
      });

      return result;

    } catch (error) {
      if (error instanceof ConstraintViolationError) {
        throw error; // Re-throw constraint violations
      }

      // Convert other errors to constraint violations
      result.isValid = false;
      result.securityIssues.push(`File system error: ${error instanceof Error ? error.message : String(error)}`);

      const violation = new ConstraintViolationError(
        'fileSystemError',
        error instanceof Error ? error.message : String(error),
        'successful file system access',
        {
          operationId,
          operation,
          filePath,
          originalError: error,
        }
      );

      globalConstraintEnforcer.emit('constraint:violation', {
        constraint: 'fileSystemError',
        violation,
        filePath,
      });

      throw violation;
    }
  }

  /**
   * Copy a file ensuring no symlinks are created (standalone copies only)
   */
  async copyFileStandalone(src: string, dest: string, operationId?: string): Promise<void> {
    // Validate source path
    await this.validatePath(src, 'copy', operationId);
    
    // Validate destination path (create operation)
    const destDir = path.dirname(dest);
    await fs.ensureDir(destDir);
    
    try {
      // Read source file content (this dereferences any symlinks)
      const content = await fs.readFile(src);
      
      // Write content directly to destination (no symlink creation)
      await fs.writeFile(dest, content);
      
      // Verify the copy was successful and is not a symlink
      const destStats = await fs.lstat(dest);
      if (destStats.isSymbolicLink()) {
        // This should not happen with writeFile, but check anyway
        await fs.remove(dest);
        throw new ConstraintViolationError(
          'symlinkPrevention',
          'symlink created during copy',
          'standalone file copy',
          {
            operationId,
            src,
            dest,
          }
        );
      }

      globalConstraintEnforcer.emit('filesystem:copied', {
        operationId,
        src,
        dest,
        size: content.length,
      });

    } catch (error) {
      if (error instanceof ConstraintViolationError) {
        throw error;
      }

      const violation = new ConstraintViolationError(
        'fileSystemCopy',
        error instanceof Error ? error.message : String(error),
        'successful standalone file copy',
        {
          operationId,
          src,
          dest,
          originalError: error,
        }
      );

      throw violation;
    }
  }

  /**
   * Bundle files into a directory ensuring all are standalone copies
   */
  async bundleFiles(files: string[], outputDir: string, operationId?: string): Promise<void> {
    // Ensure output directory exists
    await fs.ensureDir(outputDir);
    
    const bundleId = globalConstraintEnforcer.startOperation(`bundle:${outputDir}`, {
      fileCount: files.length,
      outputDir,
    });

    try {
      // Process files in parallel with concurrency limit
      const concurrency = 5;
      const chunks = this.chunkArray(files, concurrency);
      
      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (file) => {
          const fileName = path.basename(file);
          const destPath = path.join(outputDir, fileName);
          
          // Ensure unique names to prevent conflicts
          const uniqueDestPath = await this.ensureUniqueFileName(destPath);
          
          await this.copyFileStandalone(file, uniqueDestPath, bundleId);
        }));
      }

      globalConstraintEnforcer.emit('filesystem:bundled', {
        operationId,
        bundleId,
        fileCount: files.length,
        outputDir,
      });

    } finally {
      globalConstraintEnforcer.endOperation(bundleId);
    }
  }

  /**
   * Export files with constraint validation
   */
  async exportFiles(files: Record<string, string>, outputDir: string, operationId?: string): Promise<void> {
    await fs.ensureDir(outputDir);
    
    const exportId = globalConstraintEnforcer.startOperation(`export:${outputDir}`, {
      fileCount: Object.keys(files).length,
      outputDir,
    });

    try {
      // Validate and write each file
      for (const [relativePath, content] of Object.entries(files)) {
        const fullPath = path.join(outputDir, relativePath);
        const dir = path.dirname(fullPath);
        
        // Ensure directory exists
        await fs.ensureDir(dir);
        
        // Validate the output path
        await this.validatePath(fullPath, 'export', exportId);
        
        // Validate content size
        globalConstraintEnforcer.validatePayloadSize(content, exportId);
        
        // Write file (never create symlinks)
        await fs.writeFile(fullPath, content, 'utf8');
        
        // Verify no symlink was created
        const stats = await fs.lstat(fullPath);
        if (stats.isSymbolicLink()) {
          await fs.remove(fullPath);
          throw new ConstraintViolationError(
            'symlinkPrevention',
            'symlink created during export',
            'standalone file',
            {
              operationId: exportId,
              filePath: fullPath,
            }
          );
        }
      }

      globalConstraintEnforcer.emit('filesystem:exported', {
        operationId,
        exportId,
        fileCount: Object.keys(files).length,
        outputDir,
      });

    } finally {
      globalConstraintEnforcer.endOperation(exportId);
    }
  }

  /**
   * Check for path traversal attempts
   */
  private hasPathTraversal(filePath: string): boolean {
    const normalized = path.normalize(filePath);
    return normalized.includes('../') || normalized.includes('..\\');
  }

  /**
   * Ensure unique file name to prevent conflicts during bundling
   */
  private async ensureUniqueFileName(filePath: string): Promise<string> {
    let uniquePath = filePath;
    let counter = 1;
    
    while (await fs.pathExists(uniquePath)) {
      const ext = path.extname(filePath);
      const base = path.basename(filePath, ext);
      const dir = path.dirname(filePath);
      uniquePath = path.join(dir, `${base}_${counter}${ext}`);
      counter++;
    }
    
    return uniquePath;
  }

  /**
   * Chunk array for parallel processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get file system constraint status
   */
  getConstraintStatus(): {
    maxPathLength: number;
    maxSymlinkDepth: number;
    allowedExtensions: string[];
    violations: {
      symlinks: number;
      pathTraversal: number;
      invalidPaths: number;
    };
  } {
    return {
      maxPathLength: this.maxPathLength,
      maxSymlinkDepth: this.maxSymlinkDepth,
      allowedExtensions: Array.from(this.allowedExtensions),
      violations: {
        symlinks: 0, // Would be tracked via event listeners
        pathTraversal: 0,
        invalidPaths: 0,
      },
    };
  }
}

/**
 * Global file system constraints instance
 */
export const globalFileSystemConstraints = new FileSystemConstraints();

/**
 * Decorator for automatic file system constraint enforcement
 */
export function withFileSystemConstraints(operation: FileSystemOperation) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      const operationId = globalConstraintEnforcer.startOperation(`fs:${operation}`, {
        method: propertyName,
        args: args.length,
      });

      try {
        // Validate file paths in arguments if they exist
        for (const arg of args) {
          if (typeof arg === 'string' && (arg.includes('/') || arg.includes('\\'))) {
            await globalFileSystemConstraints.validatePath(arg, operation, operationId);
          }
        }

        const result = await method.apply(this, args);
        globalConstraintEnforcer.endOperation(operationId);
        return result;
      } catch (error) {
        globalConstraintEnforcer.endOperation(operationId);
        throw error;
      }
    } as T;

    return descriptor;
  };
}

/**
 * Utility function for safe file operations with constraint enforcement
 */
export async function safeFileOperation<T>(
  operation: FileSystemOperation,
  filePath: string,
  fn: (validatedPath: string) => Promise<T>,
  operationId?: string
): Promise<T> {
  const validation = await globalFileSystemConstraints.validatePath(filePath, operation, operationId);
  return await fn(validation.resolvedPath);
}

/**
 * Utility to copy files ensuring no symlinks (implements "standalone/bundle copy files" constraint)
 */
export async function copyStandalone(src: string, dest: string, operationId?: string): Promise<void> {
  return globalFileSystemConstraints.copyFileStandalone(src, dest, operationId);
}

/**
 * Utility to bundle multiple files ensuring all are standalone copies
 */
export async function bundleStandalone(files: string[], outputDir: string, operationId?: string): Promise<void> {
  return globalFileSystemConstraints.bundleFiles(files, outputDir, operationId);
}