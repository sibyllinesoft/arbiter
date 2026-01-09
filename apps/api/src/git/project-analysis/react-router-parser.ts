/**
 * @module project-analysis/react-router-parser
 * React Router parsing utilities using TypeScript AST.
 */

import ts from "typescript";
import type { FrontendRouteInfo } from "./types";

/**
 * Extracts React Router routes from source code.
 */
export function extractReactRouterRoutes(
  content: string,
  relativePath: string,
): FrontendRouteInfo[] {
  const sourceFile = ts.createSourceFile(
    relativePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const routes: FrontendRouteInfo[] = [];
  const seen = new Set<string>();

  const recordRoute = (
    pathValue: string | undefined,
    component?: string,
    metadata?: Record<string, unknown>,
  ) => {
    if (!pathValue) return;
    let normalized = pathValue.trim();
    if (!normalized) return;
    if (normalized === "index") {
      normalized = "/";
    }
    if (!normalized.startsWith("/")) {
      normalized = `/${normalized.replace(/^\//, "")}`;
    }
    const key = `${relativePath}:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);

    routes.push({
      path: normalized,
      filePath: relativePath,
      routerType: "react-router",
      component: component?.trim(),
      metadata: {
        ...metadata,
        source: "react-router-jsx",
      },
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (tagName === "Route") {
        const { path, component, meta } = extractRouteFromJsx(node, sourceFile);
        recordRoute(path, component, meta);
      }
    } else if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName.getText(sourceFile);
      if (tagName === "Route") {
        const { path, component, meta } = extractRouteFromJsx(node.openingElement, sourceFile);
        recordRoute(path, component, meta);
      }
    } else if (ts.isObjectLiteralExpression(node)) {
      const objectRoute = extractRouteFromObjectLiteral(node, sourceFile);
      if (objectRoute) {
        recordRoute(objectRoute.path, objectRoute.component, {
          ...objectRoute.metadata,
          source: "react-router-config",
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return routes;
}

function extractRouteFromJsx(
  element: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
): { path?: string; component?: string; meta: Record<string, unknown> } {
  const attributes = element.attributes.properties;
  const meta: Record<string, unknown> = {};
  let pathValue: string | undefined;
  let componentName: string | undefined;

  attributes.forEach((attr) => {
    if (!ts.isJsxAttribute(attr)) return;
    const attrName = attr.name.getText(sourceFile);
    if (attrName === "path") {
      pathValue = extractStringFromAttribute(attr, sourceFile);
    } else if (attrName === "index") {
      pathValue = pathValue ?? "index";
      meta.index = true;
    } else if (attrName === "element" || attrName === "Component" || attrName === "component") {
      componentName = extractComponentName(attr, sourceFile);
    } else if (attr.initializer) {
      const rawValue = attr.initializer.getText(sourceFile);
      meta[attrName] = rawValue;
    }
  });

  return { path: pathValue, component: componentName, meta };
}

function extractRouteFromObjectLiteral(
  node: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
): { path?: string; component?: string; metadata: Record<string, unknown> } | null {
  let pathValue: string | undefined;
  let componentName: string | undefined;
  const metadata: Record<string, unknown> = {};

  node.properties.forEach((property) => {
    if (!ts.isPropertyAssignment(property)) return;
    const name =
      property.name && ts.isIdentifier(property.name)
        ? property.name.text
        : property.name?.getText(sourceFile);
    if (!name) return;

    if (name === "path") {
      pathValue = extractStringFromExpression(property.initializer, sourceFile);
    } else if (name === "element" || name === "Component" || name === "component") {
      componentName = extractComponentFromExpression(property.initializer, sourceFile);
    } else {
      metadata[name] = property.initializer.getText(sourceFile);
    }
  });

  if (!pathValue) {
    return null;
  }

  return { path: pathValue, component: componentName, metadata };
}

function extractStringFromAttribute(
  attr: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (!attr.initializer) return undefined;
  if (ts.isStringLiteral(attr.initializer)) {
    return attr.initializer.text;
  }
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    return extractStringFromExpression(attr.initializer.expression, sourceFile);
  }
  return undefined;
}

function extractStringFromExpression(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (ts.isStringLiteral(expression)) {
    return expression.text;
  }
  if (ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  if (ts.isTemplateExpression(expression)) {
    if (!expression.templateSpans.length) {
      return expression.head.text;
    }
    return expression.getText(sourceFile);
  }
  return undefined;
}

function extractComponentName(
  attr: ts.JsxAttribute,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (!attr.initializer || !ts.isJsxExpression(attr.initializer)) return undefined;
  if (!attr.initializer.expression) return undefined;
  return extractComponentFromExpression(attr.initializer.expression, sourceFile);
}

function extractComponentFromExpression(
  exp: ts.Expression,
  sourceFile: ts.SourceFile,
): string | undefined {
  if (ts.isJsxElement(exp)) {
    return exp.openingElement.tagName.getText(sourceFile);
  }
  if (ts.isJsxSelfClosingElement(exp)) {
    return exp.tagName.getText(sourceFile);
  }
  if (ts.isIdentifier(exp)) {
    return exp.text;
  }
  if (ts.isCallExpression(exp)) {
    return exp.expression.getText(sourceFile);
  }
  return exp.getText(sourceFile);
}
