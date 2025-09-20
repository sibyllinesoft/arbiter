import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import chalk from 'chalk';
import { glob } from 'glob';
import type { APISurface, APISymbol, SurfaceOptions } from './types.js';
import { calculateStatistics } from './utils.js';

type PythonExtractionCommand = {
  readonly name: string;
  readonly description: string;
  execute(options: SurfaceOptions): Promise<APISurface | null>;
  canExecute(): Promise<boolean>;
};

class PyrightExtractionCommand implements PythonExtractionCommand {
  readonly name = 'pyright';
  readonly description = 'pyright stub generation';

  async canExecute(): Promise<boolean> {
    return await this.checkPythonProject();
  }

  async execute(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractPythonWithPyright(options);
  }

  private async checkPythonProject(): Promise<boolean> {
    const results = await Promise.all([
      glob('pyproject.toml'),
      glob('setup.py'),
      glob('**/*.py', { ignore: ['__pycache__/**', 'node_modules/**'] }),
    ]);
    return results.some(files => files.length > 0);
  }
}

class StubgenExtractionCommand implements PythonExtractionCommand {
  readonly name = 'stubgen';
  readonly description = 'stubgen';

  async canExecute(): Promise<boolean> {
    return await this.checkPythonProject();
  }

  async execute(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractPythonWithStubgen(options);
  }

  private async checkPythonProject(): Promise<boolean> {
    const results = await Promise.all([
      glob('pyproject.toml'),
      glob('setup.py'),
      glob('**/*.py', { ignore: ['__pycache__/**', 'node_modules/**'] }),
    ]);
    return results.some(files => files.length > 0);
  }
}

class AstParsingExtractionCommand implements PythonExtractionCommand {
  readonly name = 'ast-parsing';
  readonly description = 'basic AST parsing';

  async canExecute(): Promise<boolean> {
    const pythonFiles = await glob('**/*.py', {
      ignore: ['__pycache__/**', 'node_modules/**'],
    });
    return pythonFiles.length > 0;
  }

  async execute(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractPythonWithAstParsing(options);
  }
}

class PythonExtractionInvoker {
  private commands: PythonExtractionCommand[] = [
    new PyrightExtractionCommand(),
    new StubgenExtractionCommand(),
    new AstParsingExtractionCommand(),
  ];

  async executeExtraction(options: SurfaceOptions): Promise<APISurface | null> {
    const hasValidCommands = await this.validateCommands();
    if (!hasValidCommands) {
      console.log(chalk.yellow('No Python project files found'));
      return null;
    }

    console.log(chalk.dim('Attempting Python surface extraction...'));

    for (let i = 0; i < this.commands.length; i++) {
      const command = this.commands[i];

      try {
        console.log(chalk.dim(`Strategy ${i + 1}: Attempting ${command.description}...`));

        const canExecute = await command.canExecute();
        if (!canExecute) {
          console.log(chalk.dim(`${command.name} cannot execute for this project`));
          continue;
        }

        const result = await command.execute(options);
        if (result) {
          console.log(chalk.green(`✅ Successfully extracted using ${command.name}`));
          return result;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(chalk.dim(`${command.name} failed: ${errorMsg}`));
      }
    }

    console.log(chalk.red('❌ All Python extraction strategies failed'));
    return null;
  }

  private async validateCommands(): Promise<boolean> {
    for (const command of this.commands) {
      if (await command.canExecute()) {
        return true;
      }
    }
    return false;
  }
}

export async function extractPythonSurface(
  options: SurfaceOptions,
  _sourceFiles: string[] = []
): Promise<APISurface | null> {
  try {
    const invoker = new PythonExtractionInvoker();
    return await invoker.executeExtraction(options);
  } catch (error) {
    console.error(chalk.red('Python surface extraction failed:'), error);
    return null;
  }
}

async function extractPythonWithPyright(options: SurfaceOptions): Promise<APISurface | null> {
  return new Promise(resolve => {
    const child = spawn('pyright', ['--createstub', '.'], { stdio: 'pipe' });
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', data => {
      output += data.toString();
    });

    child.stderr.on('data', data => {
      errorOutput += data.toString();
    });

    child.on('close', async code => {
      if (code !== 0) {
        throw new Error(`pyright failed: ${errorOutput}`);
      }

      try {
        const stubFiles = await glob('**/*.pyi', {
          ignore: ['node_modules/**', '__pycache__/**'],
        });

        const symbols: APISymbol[] = [];

        for (const stubFile of stubFiles) {
          const content = await readFile(stubFile, 'utf-8');
          const fileSymbols = await parsePythonStubFile(stubFile, content, options);
          symbols.push(...fileSymbols);
        }

        resolve(await createSurface(symbols));
      } catch (error) {
        throw new Error(`Failed to parse pyright stubs: ${error}`);
      }
    });

    child.on('error', error => {
      throw new Error(`pyright command failed: ${error.message}`);
    });
  });
}

async function extractPythonWithStubgen(options: SurfaceOptions): Promise<APISurface | null> {
  return new Promise(resolve => {
    const child = spawn('stubgen', ['-o', 'stubs', '.'], { stdio: 'pipe' });
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', data => {
      output += data.toString();
    });

    child.stderr.on('data', data => {
      errorOutput += data.toString();
    });

    child.on('close', async code => {
      if (code !== 0) {
        throw new Error(`stubgen failed: ${errorOutput}`);
      }

      try {
        const stubFiles = await glob('stubs/**/*.pyi');
        const symbols: APISymbol[] = [];

        for (const stubFile of stubFiles) {
          const content = await readFile(stubFile, 'utf-8');
          const fileSymbols = await parsePythonStubFile(stubFile, content, options);
          symbols.push(...fileSymbols);
        }

        resolve(await createSurface(symbols));
      } catch (error) {
        throw new Error(`Failed to parse stubgen output: ${error}`);
      }
    });

    child.on('error', error => {
      throw new Error(`stubgen command failed: ${error.message}`);
    });
  });
}

async function extractPythonWithAstParsing(options: SurfaceOptions): Promise<APISurface | null> {
  const pythonFiles = await glob('**/*.py', {
    ignore: ['__pycache__/**', 'node_modules/**'],
  });

  if (pythonFiles.length === 0) {
    return null;
  }

  const symbols: APISymbol[] = [];

  for (const file of pythonFiles) {
    const content = await readFile(file, 'utf-8');
    const fileSymbols = await parsePythonFile(file, content, options);
    symbols.push(...fileSymbols);
  }

  if (symbols.length === 0) {
    return null;
  }

  console.log(chalk.green('✅ Successfully extracted using AST parsing'));
  return await createSurface(symbols);
}

async function parsePythonStubFile(
  filePath: string,
  content: string,
  options: SurfaceOptions
): Promise<APISymbol[]> {
  const symbols: APISymbol[] = [];
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const funcMatch = trimmedLine.match(/^def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*(.+?))?:/);
    if (funcMatch) {
      const [, name, params, returnType] = funcMatch;

      symbols.push({
        name,
        type: 'function',
        visibility: name.startsWith('_') ? 'private' : 'public',
        signature: trimmedLine,
        location: { file: filePath, line: lineIndex + 1, column: 1 },
        parameters: params
          .split(',')
          .map(p => {
            const paramParts = p.trim().split(':');
            return {
              name: paramParts[0]?.trim() || 'param',
              type: paramParts[1]?.trim() || 'Any',
            };
          })
          .filter(p => p.name && p.name !== 'param'),
        returnType: returnType?.trim(),
      });
    }

    const classMatch = trimmedLine.match(/^class\s+(\w+)(?:\([^)]*\))?:/);
    if (classMatch) {
      const [, name] = classMatch;

      symbols.push({
        name,
        type: 'class',
        visibility: name.startsWith('_') ? 'private' : 'public',
        signature: trimmedLine,
        location: { file: filePath, line: lineIndex + 1, column: 1 },
      });
    }
  }

  return options.includePrivate ? symbols : symbols.filter(s => s.visibility === 'public');
}

async function parsePythonFile(
  filePath: string,
  content: string,
  options: SurfaceOptions
): Promise<APISymbol[]> {
  const symbols: APISymbol[] = [];
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const funcMatch = trimmedLine.match(/^def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*(.+?))?:/);
    if (funcMatch) {
      const [, name, params, returnType] = funcMatch;

      symbols.push({
        name,
        type: 'function',
        visibility: name.startsWith('_') ? 'private' : 'public',
        signature: trimmedLine,
        location: { file: filePath, line: lineIndex + 1, column: 1 },
        parameters: params
          .split(',')
          .map(p => {
            const paramParts = p.trim().split(':');
            return {
              name: paramParts[0]?.trim() || 'param',
              type: paramParts[1]?.trim() || 'Any',
            };
          })
          .filter(p => p.name && p.name !== 'param'),
        returnType: returnType?.trim(),
      });
    }

    const classMatch = trimmedLine.match(/^class\s+(\w+)(?:\([^)]*\))?:/);
    if (classMatch) {
      const [, name] = classMatch;

      symbols.push({
        name,
        type: 'class',
        visibility: name.startsWith('_') ? 'private' : 'public',
        signature: trimmedLine,
        location: { file: filePath, line: lineIndex + 1, column: 1 },
      });
    }
  }

  return options.includePrivate ? symbols : symbols.filter(s => s.visibility === 'public');
}

async function getPythonVersion(): Promise<string> {
  return new Promise(resolve => {
    const child = spawn('python3', ['--version'], { stdio: 'pipe' });
    let output = '';

    child.stdout.on('data', data => {
      output += data.toString();
    });

    child.on('close', () => {
      const version = output.match(/Python\s+([\d.]+)/)?.[1] || 'unknown';
      resolve(version);
    });

    child.on('error', () => {
      const child2 = spawn('python', ['--version'], { stdio: 'pipe' });
      let output2 = '';

      child2.stdout.on('data', data => {
        output2 += data.toString();
      });

      child2.on('close', () => {
        const version = output2.match(/Python\s+([\d.]+)/)?.[1] || 'unknown';
        resolve(version);
      });

      child2.on('error', () => {
        resolve('unknown');
      });
    });
  });
}

async function createSurface(symbols: APISymbol[]): Promise<APISurface> {
  return {
    language: 'python',
    version: await getPythonVersion(),
    timestamp: Date.now(),
    symbols,
    statistics: calculateStatistics(symbols),
  };
}
