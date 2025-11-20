import type { Fragment } from "@/types/api";
import type { FileTreeItem } from "@/types/ui";

/**
 * Build a nested file tree from flat fragment list.
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
    const parts = fragment.path.split("/").filter(Boolean);
    let currentPath = "";
    let currentLevel = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      currentPath = currentPath !== "" ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      let existingItem = currentLevel.find((item) => item.path === currentPath);

      if (!existingItem) {
        const newItem: FileTreeItem = {
          id: isFile ? fragment.id : currentPath,
          path: currentPath,
          type: isFile ? "file" : "directory",
        };

        if (!isFile) {
          newItem.children = [];
        } else {
          newItem.hasUnsavedChanges = unsavedChanges.has(fragment.id);
        }

        currentLevel.push(newItem);
        pathMap.set(currentPath, newItem);
        existingItem = newItem;
      }

      if (isFile && existingItem.hasUnsavedChanges !== unsavedChanges.has(fragment.id)) {
        existingItem.hasUnsavedChanges = unsavedChanges.has(fragment.id);
      }

      if (!isFile && existingItem.children) {
        currentLevel = existingItem.children;
      }
    }
  }

  return tree;
}
