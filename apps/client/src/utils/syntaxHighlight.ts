import yaml from "yaml";

type HighlightLanguage = "json" | "yaml" | "dockerfile" | "shell" | "gherkin";

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

const INDENT = "  ";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const indentFor = (level: number): string => INDENT.repeat(Math.max(level, 0));

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

const findCommentIndex = (line: string): number => {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (char === "#" && !inSingle && !inDouble) {
      return index;
    }
  }
  return -1;
};

const classifyScalar = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^['"].*['"]$/.test(trimmed)) return "syntax-string";
  if (/^(true|false)$/i.test(trimmed)) return "syntax-boolean";
  if (/^null$/i.test(trimmed)) return "syntax-null";
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return "syntax-number";
  if (/^[A-Z_][A-Z0-9_]*$/.test(trimmed)) return "syntax-directive";
  if (/^(![a-zA-Z]+)/.test(trimmed)) return "syntax-directive";
  return null;
};

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

const highlightDash = (dashPart: string): string => {
  if (!dashPart) return "";
  const before = dashPart.match(/^\s*/)?.[0] ?? "";
  const after = dashPart.slice(before.length + 1);
  return `${escapeHtml(before)}<span class="syntax-symbol">-</span>${escapeHtml(after)}`;
};

const highlightYaml = (code: string): string =>
  code
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      if (!line) return "";
      const indent = line.match(/^\s*/)?.[0] ?? "";
      const rest = line.slice(indent.length);
      if (!rest) {
        return indent;
      }
      if (rest.trimStart().startsWith("#")) {
        return `${indent}<span class="syntax-comment">${escapeHtml(rest.trimStart())}</span>`;
      }
      const keyMatch = rest.match(/^(-\s*)?([^:#]+?)(\s*:\s*)(.*)$/);
      if (keyMatch) {
        const [, dashPartRaw = "", keyRaw = "", separatorRaw = "", remainderRaw = ""] = keyMatch;
        const dashPart = dashPartRaw ?? "";
        const key = keyRaw ?? "";
        const separator = separatorRaw ?? "";
        const remainder = remainderRaw ?? "";
        const highlightedDash = dashPart ? highlightDash(dashPart) : "";
        const highlightedKey = `<span class="syntax-key">${escapeHtml(key.trimEnd())}</span>`;
        const highlightedValue = highlightYamlValue(remainder);
        return `${indent}${highlightedDash}${highlightedKey}${escapeHtml(separator)}${highlightedValue}`;
      }
      if (rest.trimStart().startsWith("-")) {
        const dashSplit = rest.match(/^(-\s*)(.*)$/);
        if (dashSplit) {
          const [, dashPart = "", remainder = ""] = dashSplit;
          return `${indent}${highlightDash(dashPart)}${highlightYamlValue(remainder)}`;
        }
      }
      return `${indent}${highlightYamlValue(rest)}`;
    })
    .join("\n");

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

const DOCKER_DIRECTIVE = /^([A-Z][A-Z0-9_]*)(\s+)(.*)$/;

const highlightDockerfile = (code: string): string =>
  code
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      const indent = line.match(/^\s*/)?.[0] ?? "";
      const rest = line.slice(indent.length);
      if (!rest) return indent;
      const directiveMatch = rest.match(DOCKER_DIRECTIVE);
      if (directiveMatch) {
        const [, directive = "", spacing = "", remainder = ""] = directiveMatch;
        const highlightedDirective = `<span class="syntax-directive">${escapeHtml(directive)}</span>`;
        const highlightedRemainder = highlightShellLine(remainder);
        return `${indent}${highlightedDirective}${escapeHtml(spacing)}${highlightedRemainder}`;
      }
      return `${indent}${highlightShellLine(rest)}`;
    })
    .join("\n");

const highlightJson = (code: string): string => {
  try {
    const parsed = JSON.parse(code);
    return renderJson(parsed, 0);
  } catch (error) {
    // Gracefully fall back to escaping without syntax colouring when JSON is invalid
    return escapeHtml(code);
  }
};

const highlightYamlWithParser = (code: string): string => {
  try {
    const parsed = yaml.parse(code);
    const reserialized = yaml.stringify(parsed, { indent: 2 }).trimEnd();
    return highlightYaml(reserialized);
  } catch (error) {
    return highlightYaml(code);
  }
};

const GHERKIN_KEYWORD_REGEX =
  /^(\s*)(Scenario Outline|Scenario|Feature|Background|Examples|Given|When|Then|And|But)(\b|:)(.*)$/i;

const highlightGherkin = (code: string): string =>
  code
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      if (!line) return "";
      const trimmed = line.trim();
      if (!trimmed) {
        return "";
      }
      if (trimmed.startsWith("#")) {
        return `<span class="syntax-comment">${escapeHtml(line)}</span>`;
      }
      if (trimmed.startsWith("@")) {
        return `<span class="syntax-key">${escapeHtml(line)}</span>`;
      }
      const keywordMatch = line.match(GHERKIN_KEYWORD_REGEX);
      if (keywordMatch) {
        const [, indent = "", keyword = "", boundary = "", rest = ""] = keywordMatch;
        const remaining = rest ?? "";
        return `${escapeHtml(indent)}<span class="syntax-key">${escapeHtml(keyword)}</span>${escapeHtml(boundary)}${escapeHtml(
          remaining,
        )}`;
      }
      return escapeHtml(line);
    })
    .join("\n");

const highlightByLanguage = (code: string, language: HighlightLanguage): string => {
  switch (language) {
    case "json":
      return highlightJson(code);
    case "yaml":
      return highlightYamlWithParser(code);
    case "dockerfile":
      return highlightDockerfile(code);
    case "shell":
      return highlightShell(code);
    case "gherkin":
      return highlightGherkin(code);
    default:
      return escapeHtml(code);
  }
};

export const normalizeSyntaxLanguage = (
  language?: string | null,
): HighlightLanguage | undefined => {
  if (!language) return undefined;
  const normalized = LANGUAGE_ALIASES[language.toLowerCase()];
  return normalized;
};

export const getHighlightedCode = (code: string, language?: string | null): string | null => {
  const normalized = normalizeSyntaxLanguage(language ?? undefined);
  if (!normalized) return null;
  return highlightByLanguage(code, normalized);
};

export const isHighlightLanguage = (language?: string | null): boolean =>
  Boolean(normalizeSyntaxLanguage(language ?? undefined));
