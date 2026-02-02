### 1. Shift from "Source Parsing" to "Structural & Dependency Analysis"

**The Problem:**
In `plugins/nodejs.ts`, you are using `react-docgen-typescript` to parse props and components. In `plugins/python.ts`, you are regex-scanning import statements in source files. This is slow and brittle (false positives/negatives are common with regex on code).

**The Solution:**
Stop reading source code content (mostly). Rely on **Manifests** (package.json, go.mod), **Lockfiles**, and **File Structure**.

*   **Logic Change:** If `package.json` has `react` and `react-dom`, it is a Frontend. You don't need to find a `.tsx` file and parse components to know that.
*   **Robustness:** Lockfiles (yarn.lock, Cargo.lock) are the source of truth. A manifest might say `^18.0.0`, but the lockfile tells you exactly what is installed.
*   **Benefit:** massive performance gain and elimination of parsing errors on non-standard syntax.

### 2. Centralize Classification Logic (The "Classifier Pattern")

**The Problem:**
`NodeJSPlugin`, `RustPlugin`, etc., all implement their own logic to look at dependencies and decide "Is this a service?". This leads to duplicated heuristics.

**The Solution:**
Move the `dependency-matrix.ts` logic into a shared **`ArtifactClassifier`**. Plugins should simply extract dependencies and file structures, then ask the Classifier what the artifact is.

```typescript
// src/detection/classifier.ts

export class ArtifactClassifier {
  classify(
    dependencies: string[],
    filePatterns: string[],
    hasDocker: boolean
  ): { type: ArtifactType; tags: string[]; confidence: number } {
    // 1. Check strong signals (Docker presence implies Service/Job)
    // 2. Check Dependency Matrix (express -> Service, commander -> Tool)
    // 3. Check File Patterns (cli.js -> Tool)
    
    // Return the classification
  }
}
```

### 3. Simplify the Node.js Plugin

Strip out the component prop analysis. Focus on the `package.json` scripts, which are often the best intent indicator.

**Proposed Logic for `infer` in Node.js:**

1.  **Read Scripts:**
    *   `"start": "node server.js"` -> **Service** (Confidence: High)
    *   `"build": "webpack"` + `react` dep -> **Frontend** (Confidence: High)
    *   `"bin": "./cli.js"` -> **Tool** (Confidence: Very High)
2.  **Read Deps:** (Use existing matrix)
3.  **Combine:** If it has `express` but also a `bin` entry, it might be a Tool (CLI wrapper) rather than a Service.

### 4. Improve Docker Consolidation (The "Directory Context" Approach)

**The Problem:**
Currently, `ScannerRunner` tries to "merge" artifacts at the end. This is risky.

**The Solution:**
Group evidence by **Directory** *before* inference.

Instead of `NodeJSPlugin` producing an artifact and `DockerPlugin` producing an artifact, introduce a **`ContextAggregator`** phase.

1.  **Parse Phase:** Plugins emit evidence mapped to a directory (e.g., `src/services/api/`).
2.  **Aggregation Phase:**
    *   Directory: `src/services/api/` contains:
        *   `package.json` (Evidence: Dependencies, Scripts)
        *   `Dockerfile` (Evidence: Base Image, Exposed Ports)
        *   `docker-compose.yml` entry (Evidence: Env Vars, Links)
3.  **Inference Phase:**
    *   Pass the *aggregate* bundle to a detector.
    *   Logic: "I see a `Dockerfile` AND `package.json` with Express. This is definitely a **Service**. I will use the name from `package.json` and the port from `Dockerfile`."

This prevents creating two artifacts and trying to merge them later.

### 5. Specific Code Refactoring Examples

#### A. Clean up `src/plugins/nodejs.ts`

Remove `react-docgen-typescript`. Replace the complex frontend analysis with this:

```typescript
// In src/plugins/nodejs.ts

// ... imports

export class NodeJSPlugin implements ImporterPlugin {
  // ... supports and parse methods remain similar (but lighter)

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const pkgEvidence = evidence.find(e => e.type === 'config' && e.source === 'nodejs');
    if (!pkgEvidence) return [];

    const pkg = pkgEvidence.data.fullPackage;
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const depNames = Object.keys(deps);

    // 1. Check for Binary/Tool (Strongest Signal)
    if (pkg.bin) {
      return [this.createArtifact('tool', pkg, pkgEvidence.filePath)];
    }

    // 2. Check for Frameworks via centralized Matrix
    const type = detectArtifactType({ 
      dependencies: depNames, 
      language: 'javascript',
      scripts: pkg.scripts || {} 
      // ...
    });

    // 3. Heuristic: If it has a 'start' script running node, it's likely a service
    // regardless of framework
    if (type.primaryType === 'package' && this.hasServerScript(pkg.scripts)) {
       return [this.createArtifact('service', pkg, pkgEvidence.filePath)];
    }

    return [this.createArtifact(type.primaryType, pkg, pkgEvidence.filePath)];
  }

  private hasServerScript(scripts: Record<string, string>): boolean {
    const start = scripts?.start || '';
    return start.includes('node ') || start.includes('ts-node') || start.includes('nest start');
  }
}
```

#### B. Robust Python/Go Detection without Regex

Instead of regexing file content for `import flask`, check for file *existence* which is much faster and rarely false.

**Python:**
*   Check `requirements.txt` / `pyproject.toml` (Standard).
*   Heuristic: exists `manage.py` -> Likely Django.
*   Heuristic: exists `wsgi.py` or `asgi.py` -> Likely Service.
*   Heuristic: exists `streamlit_app.py` -> Frontend.

**Go:**
*   Check `go.mod` (Standard).
*   Heuristic: exists `cmd/` directory -> Usually contains Binary/Tool entrypoints.
*   Heuristic: exists `Dockerfile` in root -> Service.

### 6. Refined Pipeline Architecture

To implement this without exploding complexity, I recommend slightly altering your `ScannerRunner.scan()` method in `src/scanner.ts`:

1.  **Build File Index** (Done)
2.  **Parse Files** (Plugins return `Evidence`)
3.  **Group Evidence by Directory** (New Step)
    *   Create a Map: `DirectoryPath -> Evidence[]`
4.  **Detect Artifacts per Directory**
    *   Iterate through directories.
    *   If directory contains `Dockerfile` + `package.json`, pass both to `NodeJSPlugin` (or a generic `ServiceBuilder`).
    *   If directory contains only `package.json` (lib style), pass to `NodeJSPlugin`.
5.  **Infer Relationships** (Optional, done last)

### Summary of "Complexity Rabbitholes" to Avoid

1.  **Code AST Parsing:** Don't do it. It's too hard to get right for every language version in an importer. Stick to config files.
2.  **Prop/Route extraction:** Don't try to document the API (routes/props) during the *import* phase. Just identify *that* it is an API. You can have a separate "Deep Analysis" command later if needed.
3.  **Merging Heuristics:** Don't try to fuzzy match "Service A" from Docker to "Service A" from Node based on string similarity if you can just match them by **file path** (`./app/Dockerfile` and `./app/package.json` are obviously the same thing).

By relying on the **Directory** as the unit of cohesion, you solve the duplicate artifact problem and make the logic significantly simpler.
