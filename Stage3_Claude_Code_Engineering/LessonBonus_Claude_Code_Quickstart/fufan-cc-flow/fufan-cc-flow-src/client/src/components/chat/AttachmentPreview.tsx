import { X, FileText, Loader2 } from "lucide-react";
import type { Attachment } from "../../types/claude";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  uploading: boolean;
}

export default function AttachmentPreview({
  attachments,
  onRemove,
  uploading,
}: AttachmentPreviewProps) {
  if (attachments.length === 0 && !uploading) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-white/5" style={{ maxHeight: 120, overflowY: "auto" }}>
      {attachments.map((a) => (
        <div
          key={a.id}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-xs text-slate-300 max-w-[200px]"
        >
          {isImageType(a.type) && a.previewUrl ? (
            <img
              src={a.previewUrl}
              alt={a.name}
              className="w-8 h-8 rounded object-cover flex-shrink-0"
            />
          ) : (
            <FileText size={14} className="text-slate-400 flex-shrink-0" />
          )}
          <span className="truncate">{a.name}</span>
          <span className="text-slate-500 flex-shrink-0">{formatSize(a.size)}</span>
          <button
            onClick={() => onRemove(a.id)}
            className="p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-white transition-colors flex-shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      {uploading && (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin" />
          上传中...
        </div>
      )}
    </div>
  );
}
