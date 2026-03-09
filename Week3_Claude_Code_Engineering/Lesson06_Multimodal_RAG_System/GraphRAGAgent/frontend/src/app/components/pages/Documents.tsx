import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, Play, RotateCcw, X, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { useAppState } from '../../store';
import { api, ApiError } from '../../api';

const statusStyles: Record<string, { bg: string; color: string }> = {
  indexed:  { bg: '#1a3a22', color: '#3fb950' },
  indexing: { bg: '#2d2a16', color: '#d29922' },
  uploaded: { bg: '#1c2128', color: '#8b949e' },
  failed:   { bg: '#3b1a1a', color: '#f85149' },
};

export function Documents() {
  const { documents, setDocuments, refreshDocuments, refreshKG } = useAppState();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [formatFilter, setFormatFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const filteredDocs = documents.filter(d => {
    if (formatFilter !== 'All' && d.format !== formatFilter) return false;
    if (statusFilter !== 'All' && d.status !== statusFilter) return false;
    if (searchTerm && !d.filename.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    setUploading(true);
    for (const file of fileArr) {
      try {
        toast.loading(`上传 ${file.name}...`, { id: `upload-${file.name}` });

        // 1. Upload
        const uploaded = await api.uploadDocument(file);
        const newDoc = {
          id: uploaded.doc_id,
          filename: uploaded.filename,
          format: uploaded.format,
          pages: 0,
          status: 'uploaded' as const,
          upload_date: new Date().toISOString(),
        };
        setDocuments(prev => [newDoc, ...prev]);
        toast.success(`${file.name} 上传成功`, { id: `upload-${file.name}` });

        // 2. Auto-start indexing
        try {
          toast.loading(`开始索引 ${file.name}...`, { id: `index-${uploaded.doc_id}` });
          const job = await api.startIndexing(uploaded.doc_id);
          setDocuments(prev =>
            prev.map(d => d.id === uploaded.doc_id
              ? { ...d, status: 'indexing', job_id: job.job_id, progress: 0 }
              : d
            )
          );
          toast.success(`${file.name} 开始索引`, { id: `index-${uploaded.doc_id}` });
        } catch (err) {
          const msg = err instanceof ApiError ? err.message : '启动索引失败';
          toast.error(msg, { id: `index-${uploaded.doc_id}` });
        }
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : '上传失败';
        toast.error(`${file.name}: ${msg}`, { id: `upload-${file.name}` });
      }
    }
    setUploading(false);
  }, [setDocuments]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleBrowse = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  };

  // ── Index / Retry ────────────────────────────────────────────────────────────

  const handleStartIndex = useCallback(async (docId: string, filename: string) => {
    try {
      const job = await api.startIndexing(docId);
      setDocuments(prev =>
        prev.map(d => d.id === docId
          ? { ...d, status: 'indexing', job_id: job.job_id, progress: 0, error: undefined }
          : d
        )
      );
      toast.success(`${filename} 开始索引`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '启动索引失败';
      toast.error(msg);
    }
  }, [setDocuments]);

  // ── Cancel ───────────────────────────────────────────────────────────────────

  const handleCancel = useCallback(async (docId: string, jobId: string) => {
    try {
      await api.cancelJob(jobId);
      setDocuments(prev =>
        prev.map(d => d.id === docId
          ? { ...d, status: 'uploaded', job_id: undefined, progress: undefined }
          : d
        )
      );
      toast.info('索引任务已取消');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '取消失败';
      toast.error(msg);
    }
  }, [setDocuments]);

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!showDeleteModal) return;
    try {
      await api.deleteDocument(showDeleteModal);
      setDocuments(prev => prev.filter(d => d.id !== showDeleteModal));
      setShowDeleteModal(null);
      toast.success('文档已删除');
      refreshKG();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '删除失败';
      toast.error(msg);
    }
  }, [showDeleteModal, setDocuments, refreshKG]);

  const deleteDoc = documents.find(d => d.id === showDeleteModal);

  return (
    <div className="p-6" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h1 className="mb-6" style={{ color: 'var(--text-1)', fontSize: 20, fontWeight: 600 }}>文档管理</h1>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg,.html"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowse}
        className="flex flex-col items-center justify-center gap-3 rounded-lg p-8 mb-6 cursor-pointer"
        style={{
          border: `2px dashed ${dragOver ? 'var(--blue)' : 'var(--border-main)'}`,
          background: dragOver ? 'rgba(88,166,255,0.05)' : 'var(--bg-s1)',
          transition: 'all 200ms ease',
          opacity: uploading ? 0.6 : 1,
          pointerEvents: uploading ? 'none' : 'auto',
        }}
      >
        <Upload size={32} style={{ color: dragOver ? 'var(--blue)' : 'var(--text-4)' }} />
        <div style={{ color: 'var(--text-2)', fontSize: 14 }}>
          {uploading ? '正在上传...' : (
            <>拖拽文件到此处，或{' '}<span style={{ color: 'var(--blue)' }}>浏览文件</span></>
          )}
        </div>
        <div style={{ color: 'var(--text-4)', fontSize: 12 }}>
          PDF &middot; DOCX &middot; DOC &middot; PPTX &middot; PPT &middot; PNG &middot; JPG &middot; HTML &nbsp;|&nbsp; 单文件最大 200MB
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={formatFilter}
          onChange={e => setFormatFilter(e.target.value)}
          className="px-3 py-1.5 rounded-md cursor-pointer"
          style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-2)', fontSize: 13 }}
        >
          <option>All</option>
          <option>PDF</option>
          <option>DOCX</option>
          <option>PPTX</option>
          <option>PNG</option>
          <option>JPG</option>
          <option>HTML</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-md cursor-pointer"
          style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-2)', fontSize: 13 }}
        >
          <option>All</option>
          <option>indexed</option>
          <option>indexing</option>
          <option>uploaded</option>
          <option>failed</option>
        </select>
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="搜索文档..."
          className="px-3 py-1.5 rounded-md flex-1"
          style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-1)', fontSize: 13, outline: 'none' }}
        />
      </div>

      {/* Document Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)' }}>
        {/* Header */}
        <div
          className="grid gap-4 px-4 py-2.5"
          style={{
            gridTemplateColumns: '24px 1fr 70px 50px 100px 140px 160px',
            background: 'var(--bg-s2)', fontSize: 11, fontWeight: 600,
            color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}
        >
          <span />
          <span>文件名</span>
          <span>格式</span>
          <span>页数</span>
          <span>状态</span>
          <span>上传日期</span>
          <span>操作</span>
        </div>

        {/* Rows */}
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <FileText size={40} style={{ color: 'var(--text-4)' }} />
            <span style={{ color: 'var(--text-3)', fontSize: 14 }}>
              {documents.length === 0 ? '暂无文档，请上传文件' : '未找到匹配文档'}
            </span>
          </div>
        ) : (
          filteredDocs.map(doc => {
            const st = statusStyles[doc.status];
            const isExpanded = expandedDoc === doc.id;
            return (
              <React.Fragment key={doc.id}>
                <div
                  className="grid gap-4 px-4 py-3 items-center"
                  style={{
                    gridTemplateColumns: '24px 1fr 70px 50px 100px 140px 160px',
                    borderBottom: '1px solid var(--border-muted)',
                    fontSize: 13,
                  }}
                >
                  <button
                    onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                    className="cursor-pointer"
                    style={{ background: 'none', border: 'none', color: 'var(--text-4)', padding: 0 }}
                  >
                    {doc.status === 'indexed'
                      ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
                      : <span style={{ width: 14, display: 'inline-block' }} />}
                  </button>
                  <span className="flex items-center gap-2 truncate" style={{ color: 'var(--text-1)' }}>
                    <FileText size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                    <span className="truncate">{doc.filename}</span>
                  </span>
                  <span style={{ color: 'var(--text-3)' }}>{doc.format}</span>
                  <span style={{ color: 'var(--text-3)' }}>{doc.pages || '—'}</span>
                  <span>
                    <span className="px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                      {doc.status === 'indexing' && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: st.color }} />
                      )}
                      {doc.status}
                    </span>
                  </span>
                  <span style={{ color: 'var(--text-4)', fontSize: 12 }}>
                    {new Date(doc.upload_date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-2">
                    {doc.status === 'uploaded' && (
                      <button
                        onClick={() => handleStartIndex(doc.id, doc.filename)}
                        className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer"
                        style={{ fontSize: 11, background: 'rgba(35,134,54,0.2)', color: 'var(--green)', border: 'none' }}
                      >
                        <Play size={10} /> 索引
                      </button>
                    )}
                    {doc.status === 'indexing' && (
                      <>
                        <div className="flex items-center gap-1.5 flex-1">
                          <div style={{ flex: 1, height: 4, background: 'var(--bg-s2)', borderRadius: 2, overflow: 'hidden', minWidth: 40 }}>
                            <div style={{ width: `${doc.progress ?? 0}%`, height: '100%', background: 'var(--yellow)', borderRadius: 2, transition: 'width 300ms' }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--yellow)', whiteSpace: 'nowrap' }}>{doc.progress ?? 0}%</span>
                        </div>
                        {doc.job_id && (
                          <button
                            onClick={() => handleCancel(doc.id, doc.job_id!)}
                            className="cursor-pointer"
                            style={{ background: 'none', border: 'none', color: 'var(--text-4)', padding: 2 }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </>
                    )}
                    {doc.status === 'indexed' && (
                      <button
                        onClick={() => navigate(`/graph?doc_id=${doc.id}`)}
                        className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer"
                        style={{ fontSize: 11, background: 'rgba(88,166,255,0.1)', color: 'var(--blue)', border: 'none' }}
                      >
                        <Eye size={10} /> 查看图谱
                      </button>
                    )}
                    {doc.status === 'failed' && (
                      <button
                        onClick={() => handleStartIndex(doc.id, doc.filename)}
                        className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer"
                        style={{ fontSize: 11, background: 'rgba(248,81,73,0.1)', color: 'var(--red)', border: 'none' }}
                      >
                        <RotateCcw size={10} /> 重试
                      </button>
                    )}
                    {doc.status !== 'indexing' && (
                      <button
                        onClick={() => setShowDeleteModal(doc.id)}
                        className="cursor-pointer p-1 rounded"
                        style={{ background: 'none', border: 'none', color: 'var(--text-4)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </span>
                </div>

                {/* Expanded Result Row */}
                {isExpanded && doc.result && (
                  <div className="px-12 py-3" style={{ background: 'var(--bg-s2)', borderBottom: '1px solid var(--border-muted)' }}>
                    <div className="flex items-center gap-4 mb-2" style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      <span>{doc.result.nodes} 个节点</span>
                      <span style={{ color: 'var(--text-4)' }}>&middot;</span>
                      <span>{doc.result.edges} 条边</span>
                      <span style={{ color: 'var(--text-4)' }}>&middot;</span>
                      <span>{doc.result.pages} 页</span>
                      <span style={{ color: 'var(--text-4)' }}>&middot;</span>
                      <span>{doc.result.extractions} 次提取</span>
                      <span style={{ color: 'var(--text-4)' }}>&middot;</span>
                      <span>{doc.result.duration.toFixed(1)}秒</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/graph?doc_id=${doc.id}`)}
                        className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer"
                        style={{ fontSize: 11, background: 'rgba(88,166,255,0.1)', color: 'var(--blue)', border: 'none' }}
                      >
                        在图谱中查看
                      </button>
                      {/* 查看提取结果：后端暂未提供独立 API，功能未开发 */}
                      <button
                        disabled
                        title="功能未开发：后端暂无提取记录独立查询接口"
                        className="flex items-center gap-1 px-2 py-1 rounded"
                        style={{ fontSize: 11, background: 'var(--bg-s1)', color: 'var(--text-4)', border: '1px solid var(--border-muted)', cursor: 'not-allowed', opacity: 0.5 }}
                      >
                        查看提取结果 <span style={{ fontSize: 9, background: 'rgba(209,75,75,0.2)', color: '#f85149', padding: '1px 4px', borderRadius: 3, marginLeft: 4 }}>未开发</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {doc.status === 'failed' && doc.error && (
                  <div className="px-12 py-2" style={{ background: 'rgba(248,81,73,0.05)', borderBottom: '1px solid var(--border-muted)' }}>
                    <span style={{ fontSize: 12, color: 'var(--red)' }}>{doc.error}</span>
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && deleteDoc && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}
          onClick={() => setShowDeleteModal(null)}
        >
          <div
            className="rounded-xl p-6"
            style={{ background: 'var(--bg-s1)', border: '1px solid var(--border-main)', width: 360, boxShadow: 'var(--shadow-lg)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="mb-3" style={{ color: 'var(--text-1)', fontSize: 16, fontWeight: 600 }}>
              确认删除 "{deleteDoc.filename}"？
            </h3>
            <p className="mb-4" style={{ color: 'var(--text-2)', fontSize: 13 }}>
              该文档及其关联的所有知识图谱数据将被永久删除，此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 rounded-md cursor-pointer"
                style={{ background: 'var(--bg-s2)', border: '1px solid var(--border-main)', color: 'var(--text-2)', fontSize: 13 }}
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-md cursor-pointer"
                style={{ background: 'rgba(248,81,73,0.15)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 13, fontWeight: 500 }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
