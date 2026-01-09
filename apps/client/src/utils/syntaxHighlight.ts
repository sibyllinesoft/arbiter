/**
 * Syntax highlighting utilities for code display.
 * Supports JSON, YAML, Dockerfile, shell, and Gherkin languages.
 */
import yaml from "yaml";

/** Supported syntax highlighting languages */
type HighlightLanguage = "json" | "yaml" | "dockerfile" | "shell" | "gherkin";

/** Language name aliases for normalization */
const LANGUAGE_ALIASES: Record<string, HighlightLanguage> = {
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  "docker-compose": "yaml",
  dockerfile: "dockerfile",
  docker: "dockerfile",
  bash: "shell",
  shell: "shell",
  sh: "shell",
  feature: "gherkin",
  gherkin: "gherkin",
};

/** Indentation unit for JSON rendering */
const INDENT = "  ";

/** Escape HTML special characters for safe display */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Generate indentation string for given nesting level */
const indentFor = (level: number): string => INDENT.repeat(Math.max(level, 0));

/** Highlight a JSON primitive value (null, string, number, boolean) */
const highlightJsonPrimitive = (value: unknown): string => {
  if (value === null) {
    return '<span class="syntax-null">null</span>';
  }
  switch (typeof value) {
    case "string":
      return `<span class="syntax-string">"${escapeHtml(value)}"</span>`;
    case "number":
      return `<span class="syntax-number">${String(value)}</span>`;
    case "boolean":
      return `<span class="syntax-boolean">${String(value)}</span>`;
    default:
      return `<span class="syntax-plain">${escapeHtml(String(value))}</span>`;
  }
};

/** Recursively render JSON with syntax highlighting */
const renderJson = (value: unknown, depth = 0): string => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value
      .map((entry, index) => {
        const rendered = renderJson(entry, depth + 1);
        const suffix = index < value.length - 1 ? "," : "";
        return `${indentFor(depth + 1)}${rendered}${suffix}`;
      })
      .join("\n");
    return `[\n${items}\n${indentFor(depth)}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return "{}";
    }
    const lines = entries.map(([key, entry], index) => {
      const renderedKey = `<span class="syntax-key">"${escapeHtml(key)}"</span>`;
      const renderedValue = renderJson(entry, depth + 1);
      const suffix = index < entries.length - 1 ? "," : "";
      return `${indentFor(depth + 1)}${renderedKey}: ${renderedValue}${suffix}`;
    });
    return `{\n${lines.join("\n")}\n${indentFor(depth)}}`;
  }
  return highlightJsonPrimitive(value);
};

/** Toggle quote state based on current character and quote states */
const updateQuoteState = (
  char: string,
  inSingle: boolean,
  inDouble: boolean,
): { inSingle: boolean; inDouble: boolean } => {
  if (char === "'" && !inDouble) return { inSingle: !inSingle, inDouble };
  if (char === '"' && !inSingle) return { inSingle, inDouble: !inDouble };
  return { inSingle, inDouble };
};

/** Check if character is a comment start outside quotes */
const isUnquotedComment = (char: string, inSingle: boolean, inDouble: boolean): boolean =>
  char === "#" && !inSingle && !inDouble;

/** Find the index of a comment character (#) outside of quotes */
const findCommentIndex = (line: string): number => {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (isUnquotedComment(char, inSingle, inDouble)) return index;
    const newState = updateQuoteState(char, inSingle, inDouble);
    inSingle = newState.inSingle;
    inDouble = newState.inDouble;
  }
  return -1;
};

/** Regex patterns for YAML scalar classification */
const YAML_SCALAR_PATTERNS: Array<{ pattern: RegExp; className: string }> = [
  { pattern: /^['"].*['"]$/, className: "syntax-string" },
  { pattern: /^(true|false)$/i, className: "syntax-boolean" },
  { pattern: /^null$/i, className: "syntax-null" },
  { pattern: /^-?\d+(?:\.\d+)?$/, className: "syntax-number" },
  { pattern: /^[A-Z_][A-Z0-9_]*$/, className: "syntax-directive" },
  { pattern: /^(![a-zA-Z]+)/, className: "syntax-directive" },
];

/** Classify a YAML scalar value and return its CSS class */
const classifyScalar = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  for (const { pattern, className } of YAML_SCALAR_PATTERNS) {
    if (pattern.test(trimmed)) return className;
  }
  return null;
};

/** Apply syntax highlighting to a YAML scalar value */
const highlightScalar = (value: string): string => {
  if (!value) return "";
  const trailingWhitespace = value.match(/\s*$/)?.[0] ?? "";
  const coreLength = value.length - trailingWhitespace.length;
  const core = value.slice(0, coreLength);
  const className = classifyScalar(core);
  const highlightedCore = className
    ? `<span class="${className}">${escapeHtml(core)}</span>`
    : escapeHtml(core);
  return `${highlightedCore}${escapeHtml(trailingWhitespace)}`;
};

/** Highlight a YAML value segment including comments */
const highlightYamlValue = (segment: string): string => {
  if (!segment) return "";
  const trimmedIndex = segment.search(/\S/);
  if (trimmedIndex === -1) {
    return escapeHtml(segment);
  }
  const leading = segment.slice(0, trimmedIndex);
  const rest = segment.slice(trimmedIndex);
  const commentIndex = findCommentIndex(rest);
  let content = rest;
  let comment = "";
  if (commentIndex >= 0) {
    content = rest.slice(0, commentIndex);
    comment = rest.slice(commentIndex);
  }
  const highlightedContent = highlightScalar(content);
  const highlightedComment = comment
    ? `<span class="syntax-comment">${escapeHtml(comment)}</span>`
    : "";
  return `${escapeHtml(leading)}${highlightedContent}${highlightedComment}`;
};

/** Highlight YAML list item dash */
const highlightDash = (dashPart: string): string => {
  if (!dashPart) return "";
  const before = dashPart.match(/^\s*/)?.[0] ?? "";
  const after = dashPart.slice(before.length + 1);
  return `${escapeHtml(before)}<span class="syntax-symbol">-</span>${escapeHtml(after)}`;
};

/** Regex for YAML key-value pattern */
const YAML_KEY_VALUE_REGEX = /^(-\s*)?([^:#]+?)(\s*:\s*)(.*)$/;

/** Regex for YAML list item pattern */
const YAML_LIST_ITEM_REGEX = /^(-\s*)(.*)$/;

/** Highlight a YAML comment line */
const highlightYamlCommentLine = (indent: string, rest: string): string =>
  `${indent}<span class="syntax-comment">${escapeHtml(rest.trimStart())}</span>`;

/** Highlight a YAML key-value line */
const highlightYamlKeyValueLine = (indent: string, match: RegExpMatchArray): string => {
  const [, dashPartRaw = "", keyRaw = "", separatorRaw = "", remainderRaw = ""] = match;
  const dashPart = dashPartRaw ?? "";
  const key = keyRaw ?? "";
  const separator = separatorRaw ?? "";
  const remainder = remainderRaw ?? "";
  const highlightedDash = dashPart ? highlightDash(dashPart) : "";
  const highlightedKey = `<span class="syntax-key">${escapeHtml(key.trimEnd())}</span>`;
  const highlightedValue = highlightYamlValue(remainder);
  return `${indent}${highlightedDash}${highlightedKey}${escapeHtml(separator)}${highlightedValue}`;
};

/** Highlight a YAML list item line */
const highlightYamlListItemLine = (indent: string, match: RegExpMatchArray): string => {
  const [, dashPart = "", remainder = ""] = match;
  return `${indent}${highlightDash(dashPart)}${highlightYamlValue(remainder)}`;
};

/** Process a single YAML line for highlighting */
const processYamlLine = (line: string): string => {
  if (!line) return "";
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const rest = line.slice(indent.length);
  if (!rest) return indent;

  if (rest.trimStart().startsWith("#")) {
    return highlightYamlCommentLine(indent, rest);
  }

  const keyMatch = rest.match(YAML_KEY_VALUE_REGEX);
  if (keyMatch) {
    return highlightYamlKeyValueLine(indent, keyMatch);
  }

  if (rest.trimStart().startsWith("-")) {
    const dashSplit = rest.match(YAML_LIST_ITEM_REGEX);
    if (dashSplit) {
      return highlightYamlListItemLine(indent, dashSplit);
    }
  }

  return `${indent}${highlightYamlValue(rest)}`;
};

/** Apply syntax highlighting to YAML code */
const highlightYaml = (code: string): string =>
  code.replace(/\r\n?/g, "\n").split("\n").map(processYamlLine).join("\n");

/** Highlight shell variable and string tokens */
const highlightShellTokens = (content: string): string => {
  if (!content) return "";
  const tokenPattern = /(\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result += escapeHtml(content.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('"') || token.startsWith("'")) {
      result += `<span class="syntax-string">${escapeHtml(token)}</span>`;
    } else {
      result += `<span class="syntax-variable">${escapeHtml(token)}</span>`;
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < content.length) {
    result += escapeHtml(content.slice(lastIndex));
  }
  return result;
};

/** Highlight a single shell script line */
const highlightShellLine = (line: string): string => {
  if (!line) return "";
  const commentIndex = findCommentIndex(line);
  let content = line;
  let comment = "";
  if (commentIndex >= 0) {
    content = line.slice(0, commentIndex);
    comment = line.slice(commentIndex);
  }
  const highlightedContent = highlightShellTokens(content);
  const highlightedComment = comment
    ? `<span class="syntax-comment">${escapeHtml(comment)}</span>`
    : "";
  return `${highlightedContent}${highlightedComment}`;
};

/** Apply syntax highlighting to shell script code */
const highlightShell = (code: string): string =>
  code
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      const indent = line.match(/^\s*/)?.[0] ?? "";
      const rest = line.slice(indent.length);
      return `${indent}${highlightShellLine(rest)}`;
    })
    .join("\n");

/** Regex for matching Dockerfile directives */
const DOCKER_DIRECTIVE = /^([A-Z][A-Z0-9_]*)(\s+)(.*)$/;

/** Highlight a Dockerfile directive match */
const highlightDockerDirective = (indent: string, match: RegExpMatchArray): string => {
  const [, directive = "", spacing = "", remainder = ""] = match;
  const highlightedDirective = `<span class="syntax-directive">${escapeHtml(directive)}</span>`;
  const highlightedRemainder = highlightShellLine(remainder);
  return `${indent}${highlightedDirective}${escapeHtml(spacing)}${highlightedRemainder}`;
};

/** Process a single Dockerfile line for highlighting */
const processDockerfileLine = (line: string): string => {
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const rest = line.slice(indent.length);
  if (!rest) return indent;

  const directiveMatch = rest.match(DOCKER_DIRECTIVE);
  if (directiveMatch) {
    return highlightDockerDirective(indent, directiveMatch);
  }

  return `${indent}${highlightShellLine(rest)}`;
};

/** Apply syntax highlighting to Dockerfile code */
const highlightDockerfile = (code: string): string =>
  code.replace(/\r\n?/g, "\n").split("\n").map(processDockerfileLine).join("\n");

/** Parse and highlight JSON code with error fallback */
const highlightJson = (code: string): string => {
  try {
    const parsed = JSON.parse(code);
    return renderJson(parsed, 0);
  } catch (error) {
    // Gracefully fall back to escaping without syntax colouring when JSON is invalid
    return escapeHtml(code);
  }
};

/** Parse and re-serialize YAML before highlighting for consistency */
const highlightYamlWithParser = (code: string): string => {
  try {
    const parsed = yaml.parse(code);
    const reserialized = yaml.stringify(parsed, { indent: 2 }).trimEnd();
    return highlightYaml(reserialized);
  } catch (error) {
    return highlightYaml(code);
  }
};

/** Regex for matching Gherkin keywords */
const GHERKIN_KEYWORD_REGEX =
  /^(\s*)(Scenario Outline|Scenario|Feature|Background|Examples|Given|When|Then|And|But)(\b|:)(.*)$/i;

/** Highlight a Gherkin keyword match */
const highlightGherkinKeyword = (match: RegExpMatchArray): string => {
  const [, indent = "", keyword = "", boundary = "", rest = ""] = match;
  const remaining = rest ?? "";
  return `${escapeHtml(indent)}<span class="syntax-key">${escapeHtml(keyword)}</span>${escapeHtml(boundary)}${escapeHtml(remaining)}`;
};

/** Process a single Gherkin line for highlighting */
const processGherkinLine = (line: string): string => {
  if (!line) return "";
  const trimmed = line.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("#")) {
    return `<span class="syntax-comment">${escapeHtml(line)}</span>`;
  }

  if (trimmed.startsWith("@")) {
    return `<span class="syntax-key">${escapeHtml(line)}</span>`;
  }

  const keywordMatch = line.match(GHERKIN_KEYWORD_REGEX);
  if (keywordMatch) {
    return highlightGherkinKeyword(keywordMatch);
  }

  return escapeHtml(line);
};

/** Apply syntax highlighting to Gherkin feature files */
const highlightGherkin = (code: string): string =>
  code.replace(/\r\n?/g, "\n").split("\n").map(processGherkinLine).join("\n");

/** Language-specific highlighters */
const HIGHLIGHTERS: Record<HighlightLanguage, (code: string) => string> = {
  json: highlightJson,
  yaml: highlightYamlWithParser,
  dockerfile: highlightDockerfile,
  shell: highlightShell,
  gherkin: highlightGherkin,
};

/** Route to appropriate highlighter based on language */
const highlightByLanguage = (code: string, language: HighlightLanguage): string =>
  (HIGHLIGHTERS[language] ?? escapeHtml)(code);

/** Normalize language name to supported highlight language */
export const normalizeSyntaxLanguage = (
  language?: string | null,
): HighlightLanguage | undefined => {
  if (!language) return undefined;
  const normalized = LANGUAGE_ALIASES[language.toLowerCase()];
  return normalized;
};

/** Get syntax-highlighted HTML for code in the given language */
export const getHighlightedCode = (code: string, language?: string | null): string | null => {
  const normalized = normalizeSyntaxLanguage(language ?? undefined);
  if (!normalized) return null;
  return highlightByLanguage(code, normalized);
};
