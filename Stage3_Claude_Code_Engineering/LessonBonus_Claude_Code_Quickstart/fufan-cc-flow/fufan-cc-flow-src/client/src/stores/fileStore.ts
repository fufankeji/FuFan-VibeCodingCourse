import { create } from "zustand";
import type { FileNode, FileContent } from "../types/file";
import { api } from "../services/api";

interface FileState {
  tree: FileNode | null;
  treeLoading: boolean;
  openFilePath: string | null;
  openFileContent: FileContent | null;
  fileLoading: boolean;
  modifiedFiles: Set<string>;
  searchQuery: string;
  searchResults: { path: string; type: string }[];

  loadTree: (projectPath: string) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  closeFile: () => void;
  markFileModified: (filePath: string) => void;
  searchFiles: (projectPath: string, query: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  tree: null,
  treeLoading: false,
  openFilePath: null,
  openFileContent: null,
  fileLoading: false,
  modifiedFiles: new Set(),
  searchQuery: "",
  searchResults: [],

  loadTree: async (projectPath) => {
    set({ treeLoading: true, tree: null });
    try {
      const tree = await api.getFileTree(projectPath);
      set({ tree, treeLoading: false });
    } catch {
      set({ treeLoading: false });
    }
  },

  openFile: async (filePath) => {
    set({ fileLoading: true, openFilePath: filePath });
    try {
      const content = await api.getFileContent(filePath);
      set({ openFileContent: content, fileLoading: false });
    } catch {
      set({ fileLoading: false, openFileContent: null });
    }
  },

  closeFile: () => {
    set({ openFilePath: null, openFileContent: null });
  },

  markFileModified: (filePath) => {
    const modified = new Set(get().modifiedFiles);
    modified.add(filePath);
    set({ modifiedFiles: modified });
  },

  searchFiles: async (projectPath, query) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const { results } = await api.searchFiles(projectPath, query);
      set({ searchResults: results });
    } catch {
      set({ searchResults: [] });
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
}));
