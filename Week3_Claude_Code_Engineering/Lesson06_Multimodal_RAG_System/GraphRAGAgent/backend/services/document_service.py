"""Document Service — file upload, metadata CRUD."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from storage import file_store as fs

ALLOWED_EXTENSIONS = {"pdf", "docx", "doc", "pptx", "ppt", "png", "jpg", "jpeg", "html"}
MAX_FILE_SIZE_MB = 200


def validate_upload(filename: str, size_bytes: int) -> tuple[bool, int, str]:
    """Returns (ok, error_code, error_msg)."""
    if not filename or "/" in filename or "\\" in filename:
        return False, 1001, "Invalid filename"
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_EXTENSIONS:
        return False, 1002, f"Unsupported file format: .{ext}. Supported: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
    size_mb = size_bytes / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        return False, 1003, f"File size {size_mb:.1f}MB exceeds {MAX_FILE_SIZE_MB}MB limit"
    return True, 0, ""


def save_upload(filename: str, content: bytes, language: str = "ch",
                enable_formula: bool = True, enable_table: bool = True) -> dict:
    doc_id = uuid.uuid4().hex[:8]
    ext = Path(filename).suffix.lower().lstrip(".")
    upload_filename = f"{doc_id}_{filename}"
    upload_path = fs.UPLOADS_DIR / upload_filename
    upload_path.write_bytes(content)

    doc = {
        "doc_id": doc_id,
        "filename": filename,
        "format": ext,
        "size_bytes": len(content),
        "pages": None,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "status": "uploaded",
        "language": language,
        "enable_formula": enable_formula,
        "enable_table": enable_table,
        "upload_filename": upload_filename,  # internal: actual stored filename
    }
    fs.save_doc(doc)
    return doc


def get_document(doc_id: str) -> dict | None:
    return fs.get_doc(doc_id)


def list_documents(page: int = 1, page_size: int = 20,
                   status: str | None = None, fmt: str | None = None) -> dict:
    index = fs.load_docs_index()
    items = list(index.values())
    items.sort(key=lambda d: d.get("uploaded_at", ""), reverse=True)
    if status:
        items = [d for d in items if d.get("status") == status]
    if fmt:
        items = [d for d in items if d.get("format") == fmt.lower()]
    total = len(items)
    start = (page - 1) * page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items[start: start + page_size],
    }


def delete_document(doc_id: str) -> tuple[bool, int, int]:
    """Delete doc and its KG contributions. Returns (ok, removed_nodes, removed_edges)."""
    doc = fs.get_doc(doc_id)
    if not doc:
        return False, 0, 0

    # Remove from KG
    removed_nodes, removed_edges = fs.remove_doc_from_kg(doc_id)

    # Remove upload file
    upload_filename = doc.get("upload_filename", "")
    upload_path = fs.UPLOADS_DIR / upload_filename
    if upload_path.exists():
        upload_path.unlink(missing_ok=True)

    # Remove associated jobs
    for meta in fs.list_all_jobs():
        if meta.get("doc_id") == doc_id:
            fs.delete_job(meta["job_id"])

    # Remove from index
    index = fs.load_docs_index()
    index.pop(doc_id, None)
    fs.save_docs_index(index)

    return True, removed_nodes, removed_edges


def update_doc_status(doc_id: str, status: str, pages: int | None = None) -> None:
    index = fs.load_docs_index()
    if doc_id in index:
        index[doc_id]["status"] = status
        if pages is not None:
            index[doc_id]["pages"] = pages
        fs.save_docs_index(index)
