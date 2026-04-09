import { X, FileText } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useFileStore } from "../../stores/fileStore";
import CodeViewer from "../ide/CodeViewer";

export default function FileViewModal() {
  const { fileViewModalOpen, setFileViewModalOpen } = useUIStore();
  const { openFilePath, closeFile } = useFileStore();

  if (!fileViewModalOpen || !openFilePath) return null;

  const fileName = openFilePath.split(/[/\\]/).pop() || "";

  const handleClose = () => {
    setFileViewModalOpen(false);
    closeFile();
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="modal-content glass-panel rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl shadow-black/60 h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} className="text-amber-glow flex-shrink-0" />
            <span className="text-sm font-medium text-slate-200 truncate font-mono">
              {fileName}
            </span>
            <span className="text-xs text-slate-500 truncate hidden sm:block">
              {openFilePath}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors flex-shrink-0 ml-2"
          >
            <X size={16} />
          </button>
        </div>

        {/* Code viewer fills remaining space */}
        <div className="flex-1 overflow-hidden">
          <CodeViewer />
        </div>
      </div>
    </div>
  );
}
