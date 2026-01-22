import { useTheme } from "@/stores/ui-store";
import type { ResolvedSpecResponse } from "@/types/api";
import { apiService } from "@services/api";
import { clsx } from "clsx";
import { AlertTriangle, Clipboard, Download, FileText, Hash, Loader2 } from "lucide-react";
import { type FC, useCallback, useEffect, useState } from "react";
import MonacoEditor from "../../Editor/MonacoEditor";

const CUE_HEADER = `// CUE Specification
// This is a reconstructed view of the resolved specification

package arbiter

`;

const NO_DATA_COMMENT = "// No resolved data available\n";
const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Check if a string is a valid CUE identifier */
function isValidIdentifier(key: string): boolean {
  return IDENTIFIER_PATTERN.test(key);
}

/** Format a key for CUE output, quoting if necessary */
function formatCueKey(key: string): string {
  return isValidIdentifier(key) ? key : `"${key}"`;
}

/** Format a string value, handling multiline */
function formatStringValue(value: string, indentStr: string): string {
  if (value.includes("\n")) {
    return `"""
${value}
${indentStr}"""`;
  }
  return `"${value}"`;
}

/** Format an array value for CUE */
function formatArrayValue(value: unknown[], indent: number, indentStr: string): string {
  if (value.length === 0) return "[]";
  const items = value.map((item) => `${indentStr}  ${formatCueValue(item, indent + 1)}`);
  return `[
${items.join(",\n")}
${indentStr}]`;
}

/** Format an object value for CUE */
function formatObjectValue(
  value: Record<string, unknown>,
  indent: number,
  indentStr: string,
): string {
  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  const fields = entries.map(([key, val]) => {
    const formattedKey = formatCueKey(key);
    return `${indentStr}  ${formattedKey}: ${formatCueValue(val, indent + 1)}`;
  });
  return `{
${fields.join("\n")}
${indentStr}}`;
}

/** Format any value for CUE output */
function formatCueValue(value: unknown, indent: number = 0): string {
  const indentStr = "  ".repeat(indent);

  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return formatStringValue(value, indentStr);
  if (Array.isArray(value)) return formatArrayValue(value, indent, indentStr);
  if (typeof value === "object" && value !== null) {
    return formatObjectValue(value as Record<string, unknown>, indent, indentStr);
  }
  return String(value);
}

/** Convert resolved data to CUE source format */
function convertToCueSource(data: Record<string, unknown>): string {
  if (!data || typeof data !== "object") {
    return CUE_HEADER + NO_DATA_COMMENT;
  }

  const entries = Object.entries(data);
  const definitions = entries.map(([key, value]) => {
    const formattedKey = formatCueKey(key);
    return `${formattedKey}: ${formatCueValue(value)}\n`;
  });

  return CUE_HEADER + definitions.join("\n");
}

interface SourceDiagramProps {
  /** Project ID to fetch resolved spec data */
  projectId: string;
  /** Additional CSS classes */
  className?: string;
  /** Optional title for the diagram */
  title?: string;
}

/** State setter functions for fetch callbacks */
interface FetchStateSetters {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSpecHash: (hash: string) => void;
  setLastSync: (time: string | null) => void;
  setSourceContent: (content: string) => void;
}

/** Handle successful spec fetch */
function handleFetchSuccess(
  response: ResolvedSpecResponse,
  setters: Pick<FetchStateSetters, "setSpecHash" | "setLastSync" | "setSourceContent">,
): void {
  setters.setSpecHash(response.spec_hash);
  setters.setLastSync(new Date().toISOString());
  const cueSource = convertToCueSource(response.resolved);
  setters.setSourceContent(cueSource);
}

/** Handle fetch error */
function handleFetchError(
  err: unknown,
  setters: Pick<FetchStateSetters, "setError" | "setSourceContent">,
): void {
  console.error("Failed to fetch resolved spec:", err);

  if (err instanceof Error && err.message.includes("404")) {
    setters.setError("Project not found or has been deleted");
    setters.setSourceContent(
      "// Project not found or has been deleted\n// Please select a valid project",
    );
  } else {
    setters.setError(err instanceof Error ? err.message : "Failed to load specification data");
    setters.setSourceContent(
      "// Error loading specification data\n// Please check the console for details",
    );
  }
}

/** Clear state when no project is selected */
function clearProjectState(setters: FetchStateSetters): void {
  setters.setLoading(false);
  setters.setError(null);
  setters.setSpecHash("");
  setters.setSourceContent(
    "// No project selected\n// Please select a project to view its specification",
  );
  setters.setLastSync(null);
}

export const SourceDiagram: FC<SourceDiagramProps> = ({
  projectId,
  className = "",
  title = "CUE Specification - Source View",
}) => {
  const { isDark } = useTheme();
  const [sourceContent, setSourceContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [specHash, setSpecHash] = useState<string>("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const stateSetters: FetchStateSetters = {
    setLoading,
    setError,
    setSpecHash,
    setLastSync,
    setSourceContent,
  };

  useEffect(() => {
    const abortController = new AbortController();

    const fetchResolvedSpec = async () => {
      try {
        setLoading(true);
        setError(null);

        await new Promise((resolve) => setTimeout(resolve, 100));
        if (abortController.signal.aborted) return;

        const response: ResolvedSpecResponse = await apiService.getResolvedSpec(projectId);
        if (abortController.signal.aborted) return;

        handleFetchSuccess(response, stateSetters);
      } catch (err) {
        if (abortController.signal.aborted) return;
        handleFetchError(err, stateSetters);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    if (projectId) {
      fetchResolvedSpec();
    } else {
      clearProjectState(stateSetters);
    }

    return () => {
      abortController.abort();
    };
  }, [projectId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sourceContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([sourceContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arbiter-spec-${specHash.substring(0, 8)}.cue`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRefresh = useCallback(() => {
    if (!projectId) return;

    setLoading(true);
    const currentProjectId = projectId;

    setTimeout(async () => {
      try {
        const response: ResolvedSpecResponse = await apiService.getResolvedSpec(currentProjectId);
        handleFetchSuccess(response, stateSetters);
      } catch (err) {
        console.error("Failed to refresh spec:", err);
        setError(err instanceof Error ? err.message : "Failed to refresh specification data");
      } finally {
        setLoading(false);
      }
    }, 100);
  }, [projectId]);

  if (loading) {
    return (
      <div
        className={clsx(
          "flex h-full flex-col bg-white text-gray-700 transition-colors dark:bg-graphite-950 dark:text-graphite-200",
          className,
        )}
      >
        <div className="flex-shrink-0 border-b border-gray-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-900">
          <h3 className="text-lg font-medium text-gray-900 dark:text-graphite-50">{title}</h3>
        </div>
        <div className="flex flex-1 items-center justify-center bg-gray-50 transition-colors dark:bg-graphite-900/40">
          <div className="flex items-center space-x-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-graphite-700 dark:bg-graphite-900">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="text-sm text-gray-600 dark:text-graphite-300">
              Loading specification source...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={clsx(
          "flex h-full flex-col bg-white text-gray-700 transition-colors dark:bg-graphite-950 dark:text-graphite-200",
          className,
        )}
      >
        <div className="flex-shrink-0 border-b border-gray-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-900">
          <h3 className="text-lg font-medium text-gray-900 dark:text-graphite-50">{title}</h3>
        </div>
        <div className="flex flex-1 items-center justify-center bg-red-50 transition-colors dark:bg-red-500/10">
          <div className="flex items-center space-x-3 rounded-lg border border-red-200 bg-white px-4 py-3 shadow-sm dark:border-red-400/40 dark:bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-300" />
            <div className="text-center">
              <div className="font-medium text-red-900 dark:text-red-200">
                Failed to load specification
              </div>
              <div className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</div>
              <button
                onClick={handleRefresh}
                className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lineCount = sourceContent.split("\n").length;
  const charCount = sourceContent.length;

  return (
    <div
      className={clsx(
        "flex h-full min-h-0 flex-col bg-white text-gray-700 transition-colors dark:bg-graphite-950 dark:text-graphite-200",
        className,
      )}
    >
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-graphite-700 bg-white dark:bg-graphite-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-graphite-25">{title}</h3>
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-graphite-400 mt-1">
              <span className="flex items-center space-x-1">
                <FileText className="w-3 h-3" />
                <span>
                  {lineCount} lines, {charCount} chars
                </span>
              </span>
              {lastSync && <span>synced {new Date(lastSync).toLocaleTimeString()}</span>}
              {specHash && (
                <span className="flex items-center space-x-1">
                  <Hash className="w-3 h-3" />
                  <code className="bg-gray-100 dark:bg-graphite-800 px-2 py-1 rounded text-xs font-mono">
                    {specHash.substring(0, 8)}...
                  </code>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              className="px-3 py-1 text-sm text-gray-600 dark:text-graphite-400 hover:text-gray-900 dark:hover:text-graphite-25 hover:bg-gray-100 dark:hover:bg-graphite-800 rounded transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={handleCopy}
              className={`px-3 py-1 text-sm rounded transition-colors flex items-center space-x-1 ${
                copySuccess
                  ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20"
                  : "text-gray-600 dark:text-graphite-400 hover:text-gray-900 dark:hover:text-graphite-25 hover:bg-gray-100 dark:hover:bg-graphite-800"
              }`}
            >
              <Clipboard className="w-3 h-3" />
              <span>{copySuccess ? "Copied!" : "Copy"}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1 text-sm text-gray-600 dark:text-graphite-400 hover:text-gray-900 dark:hover:text-graphite-25 hover:bg-gray-100 dark:hover:bg-graphite-800 rounded transition-colors flex items-center space-x-1"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editor Content - Scrollable */}
      <div className="flex-1 min-h-0 overflow-hidden bg-white dark:bg-graphite-950">
        <MonacoEditor
          value={sourceContent}
          onChange={() => {}} // Read-only for now
          language="cue"
          theme={isDark ? "cue-dark" : "cue-light"}
          options={{
            automaticLayout: true,
            wordWrap: "on",
            lineNumbers: "on",
            minimap: { enabled: true },
            folding: true,
            bracketMatching: "always",
            fontSize: 14,
            lineHeight: 1.6,
            fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", Consolas, monospace',
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            renderWhitespace: "selection",
            renderLineHighlight: "gutter",
            readOnly: true, // Make read-only since this is a derived view
            contextmenu: true,
            selectOnLineNumbers: true,
          }}
        />
      </div>
    </div>
  );
};

export default SourceDiagram;
