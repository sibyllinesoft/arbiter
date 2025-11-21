import { Archive, Code, Database, File, FileText, Image, Settings } from "lucide-react";

// File type detection for better icons
export const getFileIcon = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "cue":
      return Code;
    case "json":
      return FileText;
    case "yaml":
    case "yml":
      return Settings;
    case "md":
      return FileText;
    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
    case "gif":
      return Image;
    case "zip":
    case "tar":
    case "gz":
      return Archive;
    case "sql":
      return Database;
    default:
      return File;
  }
};
