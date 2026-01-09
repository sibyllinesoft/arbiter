/**
 * File tree construction utilities.
 * Converts flat fragment lists into hierarchical tree structures for display.
 */
import type { Fragment } from "@/types/api";
import type { FileTreeItem } from "@/types/ui";

/** Create a new file tree item for a directory */
function createDirectoryItem(path: string): FileTreeItem {
  return {
    id: path,
    path,
    type: "directory",
    children: [],
  };
}

/** Create a new file tree item for a file */
function createFileItem(path: string, fragmentId: string, hasUnsaved: boolean): FileTreeItem {
  return {
    id: fragmentId,
    path,
    type: "file",
    hasUnsavedChanges: hasUnsaved,
  };
}

/** Find or create an item in the current tree level */
function getOrCreateItem(
  currentLevel: FileTreeItem[],
  pathMap: Map<string, FileTreeItem>,
  currentPath: string,
  isFile: boolean,
  fragmentId: string,
  hasUnsaved: boolean,
): FileTreeItem {
  let existingItem = currentLevel.find((item) => item.path === currentPath);

  if (!existingItem) {
    existingItem = isFile
      ? createFileItem(currentPath, fragmentId, hasUnsaved)
      : createDirectoryItem(currentPath);
    currentLevel.push(existingItem);
    pathMap.set(currentPath, existingItem);
  }

  return existingItem;
}

/** Update unsaved state for a file item if it has changed */
function syncUnsavedState(item: FileTreeItem, hasUnsaved: boolean): void {
  if (item.hasUnsavedChanges !== hasUnsaved) {
    item.hasUnsavedChanges = hasUnsaved;
  }
}

/** Process a single fragment and insert it into the tree */
function insertFragment(
  fragment: Fragment,
  tree: FileTreeItem[],
  pathMap: Map<string, FileTreeItem>,
  unsavedChanges: Set<string>,
): void {
  const parts = fragment.path.split("/").filter(Boolean);
  let currentPath = "";
  let currentLevel = tree;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const isFile = i === parts.length - 1;
    const hasUnsaved = unsavedChanges.has(fragment.id);

    const item = getOrCreateItem(
      currentLevel,
      pathMap,
      currentPath,
      isFile,
      fragment.id,
      hasUnsaved,
    );

    if (isFile) {
      syncUnsavedState(item, hasUnsaved);
    } else if (item.children) {
      currentLevel = item.children;
    }
  }
}

/**
 * Build a nested file tree from a flat fragment list.
 * @param fragments - List of fragments with file paths
 * @param unsavedChanges - Set of fragment IDs with unsaved changes
 * @returns Hierarchical tree structure for rendering
 * Kept pure for easier testing and reuse outside the FileTree component.
 */
export function buildFileTree(
  fragments: Fragment[],
  unsavedChanges: Set<string> = new Set(),
): FileTreeItem[] {
  const tree: FileTreeItem[] = [];
  const pathMap = new Map<string, FileTreeItem>();

  const sortedFragments = [...fragments].sort((a, b) => a.path.localeCompare(b.path));

  for (const fragment of sortedFragments) {
    insertFragment(fragment, tree, pathMap, unsavedChanges);
  }

  return tree;
}
