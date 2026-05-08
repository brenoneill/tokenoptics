import type { FolderEntry, FolderReader } from "../../harnesses/types";

// FolderReader backed by a FileSystemDirectoryHandle (Chromium File System
// Access API). Walks subdirectories on demand, reads file contents as text.
export function browserFolderReader(root: FileSystemDirectoryHandle): FolderReader {
  async function resolveDir(segments: string[]): Promise<FileSystemDirectoryHandle | null> {
    let dir: FileSystemDirectoryHandle = root;
    for (const seg of segments) {
      try {
        dir = await dir.getDirectoryHandle(seg);
      } catch {
        return null;
      }
    }
    return dir;
  }

  async function resolveFile(segments: string[]): Promise<FileSystemFileHandle | null> {
    if (segments.length === 0) return null;
    const parent = await resolveDir(segments.slice(0, -1));
    if (!parent) return null;
    try {
      return await parent.getFileHandle(segments[segments.length - 1]);
    } catch {
      return null;
    }
  }

  return {
    async list(segments: string[]): Promise<FolderEntry[]> {
      const dir = await resolveDir(segments);
      if (!dir) return [];
      const out: FolderEntry[] = [];
      for await (const [name, handle] of dir.entries()) {
        out.push({ name, isDirectory: handle.kind === "directory" });
      }
      return out;
    },
    async readFile(segments: string[]): Promise<string | null> {
      const fh = await resolveFile(segments);
      if (!fh) return null;
      const file = await fh.getFile();
      return file.text();
    },
    async stat(segments: string[]) {
      const fh = await resolveFile(segments);
      if (!fh) return null;
      const file = await fh.getFile();
      return { mtimeMs: file.lastModified };
    },
  };
}
