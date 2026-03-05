import { useState } from "react";
import {
  GitBranch,
  ChevronLeft,
  ChevronRight,
  Check,
  Minus,
  Plus,
} from "lucide-react";

interface DiffHunk {
  oldStart: number;
  newStart: number;
  lines: { type: "add" | "remove" | "context"; content: string; lineNo: number }[];
}

interface DiffData {
  filePath: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  applied: boolean;
}

interface Props {
  diff: DiffData;
}

export default function DiffViewer({ diff }: Props) {
  const [currentHunk, setCurrentHunk] = useState(0);

  return (
    <div className="border border-obsidian-700/40 rounded-lg overflow-hidden my-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-obsidian-800/60 border-b border-obsidian-700/40">
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch size={13} className="text-violet-info flex-shrink-0" />
          <span className="text-xs font-mono text-obsidian-100 truncate">
            {diff.filePath}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-emerald-ok">
            +{diff.additions}
          </span>
          <span className="text-[10px] font-mono text-rose-err">
            -{diff.deletions}
          </span>
          {diff.applied && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-ok">
              <Check size={10} /> 已应用
            </span>
          )}
        </div>
      </div>

      {/* Diff lines */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {diff.hunks.map((hunk, hIdx) => (
              <HunkView key={hIdx} hunk={hunk} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Navigation */}
      {diff.hunks.length > 1 && (
        <div className="flex items-center justify-center gap-3 px-3 py-1.5 border-t border-obsidian-700/40 bg-obsidian-800/40">
          <button
            onClick={() => setCurrentHunk(Math.max(0, currentHunk - 1))}
            disabled={currentHunk === 0}
            className="p-1 rounded hover:bg-obsidian-700/40 text-obsidian-300 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-[10px] text-obsidian-400">
            第 {currentHunk + 1}/{diff.hunks.length} 个变更块
          </span>
          <button
            onClick={() =>
              setCurrentHunk(Math.min(diff.hunks.length - 1, currentHunk + 1))
            }
            disabled={currentHunk === diff.hunks.length - 1}
            className="p-1 rounded hover:bg-obsidian-700/40 text-obsidian-300 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function HunkView({ hunk }: { hunk: DiffHunk }) {
  return (
    <>
      {hunk.lines.map((line, idx) => (
        <tr
          key={idx}
          className={
            line.type === "add"
              ? "bg-emerald-ok/5"
              : line.type === "remove"
                ? "bg-rose-err/5"
                : ""
          }
        >
          <td className="w-8 text-right pr-2 select-none text-obsidian-500 border-r border-obsidian-700/30">
            {line.lineNo}
          </td>
          <td className="w-5 text-center select-none">
            {line.type === "add" ? (
              <Plus size={10} className="inline text-emerald-ok" />
            ) : line.type === "remove" ? (
              <Minus size={10} className="inline text-rose-err" />
            ) : null}
          </td>
          <td
            className={`px-2 py-0.5 whitespace-pre ${
              line.type === "add"
                ? "text-emerald-ok"
                : line.type === "remove"
                  ? "text-rose-err"
                  : "text-obsidian-200"
            }`}
          >
            {line.content}
          </td>
        </tr>
      ))}
    </>
  );
}

// Helper to create DiffData from old/new content for use by other components
export function createDiff(
  filePath: string,
  oldContent: string,
  newContent: string
): DiffData {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  let additions = 0;
  let deletions = 0;
  const lines: DiffHunk["lines"] = [];

  // Simple line-by-line diff (for teaching purposes)
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      lines.push({ type: "context", content: oldLine || "", lineNo: i + 1 });
    } else {
      if (oldLine !== undefined) {
        lines.push({ type: "remove", content: oldLine, lineNo: i + 1 });
        deletions++;
      }
      if (newLine !== undefined) {
        lines.push({ type: "add", content: newLine, lineNo: i + 1 });
        additions++;
      }
    }
  }

  return {
    filePath,
    additions,
    deletions,
    hunks: [{ oldStart: 1, newStart: 1, lines }],
    applied: true,
  };
}
