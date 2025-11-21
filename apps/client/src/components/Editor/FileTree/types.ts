export interface FileTreeProps {
  className?: string;
  multiSelect?: boolean;
  onSelectionChange?: (selectedFiles: string[]) => void;
}

export interface FileTreeRef {
  getSelectedFiles: () => string[];
  clearSelection: () => void;
  selectFiles: (fileIds: string[]) => void;
}
