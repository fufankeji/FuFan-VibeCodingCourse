import { X, Copy, Check, FileText, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useFileStore } from "../../stores/fileStore";
import { useUIStore } from "../../stores/uiStore";

const LANGUAGE_MAP: Record<string, string> = {
  typescript: "typescript",
  tsx: "tsx",
  javascript: "javascript",
  jsx: "jsx",
  python: "python",
  rust: "rust",
  go: "go",
  java: "java",
  c: "c",
  cpp: "cpp",
  css: "css",
  scss: "scss",
  html: "html",
  json: "json",
  yaml: "yaml",
  markdown: "markdown",
  bash: "bash",
  sql: "sql",
  xml: "xml",
  toml: "toml",
  plaintext: "text",
};

export default function CodeViewer() {
  const { openFilePath, openFileContent, fileLoading, closeFile } =
    useFileStore();
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen);
  const [copied, setCopied] = useState(false);

  const handleClose = useCallback(() => {
    closeFile();
    setRightPanelOpen(false);
  }, [closeFile, setRightPanelOpen]);

  const handleCopy = useCallback(() => {
    if (openFileContent?.content) {
      navigator.clipboard.writeText(openFileContent.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [openFileContent]);

  if (!openFilePath) return null;

  const fileName = openFilePath.split(/[/\\]/).pop() || "";
  const isImage = openFileContent?.language === "image";
  const language = openFileContent
    ? LANGUAGE_MAP[openFileContent.language] || "text"
    : "text";

  return (
    <div className="flex flex-col h-full bg-obsidian-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-obsidian-700/50 bg-obsidian-800/60 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={13} className="text-obsidian-300 flex-shrink-0" />
          <span className="text-xs font-mono text-obsidian-100 truncate">
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-obsidian-700/50 text-obsidian-400 hover:text-obsidian-200 transition-colors"
            title="复制全部"
          >
            {copied ? (
              <Check size={13} className="text-emerald-ok" />
            ) : (
              <Copy size={13} />
            )}
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-obsidian-700/50 text-obsidian-400 hover:text-obsidian-200 transition-colors"
            title="关闭"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Content */}
      {fileLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-obsidian-400" />
        </div>
      ) : openFileContent && isImage ? (
        <div className="flex-1 overflow-auto flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.3)" }}>
          <img
            src={openFileContent.content}
            alt={fileName}
            className="max-w-full max-h-full object-contain rounded"
            style={{ imageRendering: "auto" }}
          />
        </div>
      ) : openFileContent ? (
        <div className="flex-1 overflow-auto">
          <SyntaxHighlighter
            language={language}
            style={oneDark}
            showLineNumbers
            customStyle={{
              margin: 0,
              padding: "12px 0",
              background: "transparent",
              fontSize: "12px",
              lineHeight: "1.6",
            }}
            lineNumberStyle={{
              minWidth: "3em",
              paddingRight: "12px",
              color: "rgba(255,255,255,0.15)",
              textAlign: "right",
            }}
          >
            {openFileContent.content}
          </SyntaxHighlighter>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-obsidian-400 text-sm">
          无法加载文件内容
        </div>
      )}

      {/* Footer */}
      {openFileContent && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-obsidian-700/40 bg-obsidian-800/40 text-[10px] text-obsidian-400 font-mono flex-shrink-0">
          <span>{isImage ? "图片" : openFileContent.language}</span>
          {!isImage && <span>{openFileContent.lines} 行</span>}
          <span>{openFileContent.encoding.toUpperCase()}</span>
          <span>
            {openFileContent.size > 1024
              ? `${(openFileContent.size / 1024).toFixed(1)} KB`
              : `${openFileContent.size} B`}
          </span>
        </div>
      )}
    </div>
  );
}
