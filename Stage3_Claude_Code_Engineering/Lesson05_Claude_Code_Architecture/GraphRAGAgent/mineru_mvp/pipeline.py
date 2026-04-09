"""
MinerU Cloud API MVP Pipeline
==============================
Complete flow: Local PDF → Upload to MinerU Cloud → Parse → Download & Save Results

Usage:
    python pipeline.py                          # Parse default test_sample.pdf
    python pipeline.py path/to/your/file.pdf    # Parse a specific file
"""

import io
import json
import os
import sys
import time
import zipfile
from pathlib import Path

import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
load_dotenv()

API_TOKEN = os.getenv("MINERU_API_TOKEN")
API_BASE = os.getenv("MINERU_API_BASE", "https://mineru.net/api/v4")
OUTPUT_DIR = Path("output")
POLL_INTERVAL = 5       # seconds between status checks
MAX_POLL_TIME = 300      # max wait time in seconds

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json",
}


def check_config():
    """Validate required configuration."""
    if not API_TOKEN:
        print("[ERROR] MINERU_API_TOKEN not found in .env file.")
        sys.exit(1)
    print(f"[OK] API Token loaded (length={len(API_TOKEN)})")


# ---------------------------------------------------------------------------
# Step 1: Request pre-signed upload URL
# ---------------------------------------------------------------------------
def request_upload_url(file_name: str) -> tuple[str, str]:
    """Request a pre-signed upload URL from MinerU.

    Returns:
        (batch_id, upload_url)
    """
    print(f"\n{'='*60}")
    print(f"[Step 1] Requesting upload URL for: {file_name}")
    print(f"{'='*60}")

    resp = requests.post(
        f"{API_BASE}/file-urls/batch",
        headers=HEADERS,
        json={
            "files": [{"name": file_name, "data_id": "mvp_test"}],
            "enable_formula": True,
            "enable_table": True,
            "language": "en",
        },
    )

    print(f"  HTTP {resp.status_code}")
    data = resp.json()
    print(f"  Response: {json.dumps(data, indent=2, ensure_ascii=False)}")

    if data.get("code") != 0:
        print(f"[ERROR] Failed to get upload URL: {data.get('msg')}")
        sys.exit(1)

    batch_id = data["data"]["batch_id"]
    upload_url = data["data"]["file_urls"][0]

    print(f"  batch_id: {batch_id}")
    print(f"  upload_url: {upload_url[:80]}...")
    return batch_id, upload_url


# ---------------------------------------------------------------------------
# Step 2: Upload local file via PUT
# ---------------------------------------------------------------------------
def upload_file(file_path: Path, upload_url: str):
    """Upload local file to pre-signed URL using PUT."""
    print(f"\n{'='*60}")
    print(f"[Step 2] Uploading file: {file_path}")
    print(f"{'='*60}")

    file_size = file_path.stat().st_size
    print(f"  File size: {file_size:,} bytes ({file_size/1024:.1f} KB)")

    with open(file_path, "rb") as f:
        resp = requests.put(upload_url, data=f)

    print(f"  Upload HTTP {resp.status_code}")

    if resp.status_code not in (200, 201):
        print(f"[ERROR] Upload failed: {resp.text[:200]}")
        sys.exit(1)

    print("  Upload successful!")


# ---------------------------------------------------------------------------
# Step 3: Poll for extraction results
# ---------------------------------------------------------------------------
def poll_results(batch_id: str) -> dict:
    """Poll the batch results until done or failed."""
    print(f"\n{'='*60}")
    print(f"[Step 3] Polling results for batch: {batch_id}")
    print(f"{'='*60}")

    start_time = time.time()

    while True:
        elapsed = time.time() - start_time
        if elapsed > MAX_POLL_TIME:
            print(f"[ERROR] Timeout after {MAX_POLL_TIME}s")
            sys.exit(1)

        resp = requests.get(
            f"{API_BASE}/extract-results/batch/{batch_id}",
            headers=HEADERS,
        )
        data = resp.json()

        if data.get("code") != 0:
            print(f"[ERROR] Poll failed: {data.get('msg')}")
            sys.exit(1)

        results = data["data"]["extract_result"]
        if not results:
            print(f"  [{elapsed:.0f}s] Waiting for results...")
            time.sleep(POLL_INTERVAL)
            continue

        result = results[0]
        state = result.get("state", "unknown")
        progress = result.get("extract_progress", {})
        extracted = progress.get("extracted_pages", "?")
        total = progress.get("total_pages", "?")

        print(f"  [{elapsed:.0f}s] State: {state} | Pages: {extracted}/{total}")

        if state == "done":
            print(f"\n  Parse completed in {elapsed:.1f}s!")
            return result
        elif state == "failed":
            print(f"[ERROR] Parse failed: {result.get('err_msg')}")
            sys.exit(1)

        time.sleep(POLL_INTERVAL)


# ---------------------------------------------------------------------------
# Step 4: Download and extract results
# ---------------------------------------------------------------------------
def download_results(result: dict, output_dir: Path) -> Path:
    """Download the ZIP result and extract to output directory."""
    print(f"\n{'='*60}")
    print(f"[Step 4] Downloading and extracting results")
    print(f"{'='*60}")

    zip_url = result.get("full_zip_url")
    if not zip_url:
        print("[ERROR] No download URL in result")
        sys.exit(1)

    file_name = result.get("file_name", "unknown")
    task_output_dir = output_dir / Path(file_name).stem
    task_output_dir.mkdir(parents=True, exist_ok=True)

    print(f"  Downloading from: {zip_url[:80]}...")
    resp = requests.get(zip_url)
    print(f"  Download HTTP {resp.status_code} | Size: {len(resp.content):,} bytes")

    if resp.status_code != 200:
        print(f"[ERROR] Download failed: {resp.text[:200]}")
        sys.exit(1)

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        file_list = zf.namelist()
        print(f"  ZIP contains {len(file_list)} files:")
        for f in file_list:
            print(f"    - {f}")
        zf.extractall(task_output_dir)

    print(f"\n  Extracted to: {task_output_dir}")
    return task_output_dir


# ---------------------------------------------------------------------------
# Step 5: Analyze parsed output
# ---------------------------------------------------------------------------
def analyze_output(output_dir: Path):
    """Load and display a summary of parsed results."""
    print(f"\n{'='*60}")
    print(f"[Step 5] Analyzing parsed output")
    print(f"{'='*60}")

    # Find content_list.json (filename may have UUID prefix)
    content_list_files = list(output_dir.rglob("*content_list.json"))
    if not content_list_files:
        print("  [WARN] content_list.json not found, listing available files:")
        for f in output_dir.rglob("*"):
            if f.is_file():
                print(f"    - {f.relative_to(output_dir)}")
        return

    content_list_path = content_list_files[0]
    print(f"  Loading: {content_list_path}")

    with open(content_list_path, "r", encoding="utf-8") as f:
        content_list = json.load(f)

    print(f"  Total blocks: {len(content_list)}")

    # Count by type
    type_counts = {}
    for block in content_list:
        t = block.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + 1

    print(f"\n  Block type distribution:")
    for t, count in sorted(type_counts.items()):
        print(f"    {t:20s}: {count}")

    # Count pages
    pages = set(b.get("page_idx", 0) for b in content_list)
    print(f"\n  Pages: {len(pages)} (indices: {sorted(pages)})")

    # Show text blocks preview
    text_blocks = [b for b in content_list if b["type"] == "text"]
    print(f"\n  Text blocks ({len(text_blocks)} total):")
    for i, block in enumerate(text_blocks[:5]):
        text = block.get("text", "")
        level = block.get("text_level")
        level_str = f" [H{level}]" if level and level >= 1 else ""
        preview = text[:80] + ("..." if len(text) > 80 else "")
        print(f"    [{i}]{level_str} {preview}")

    if len(text_blocks) > 5:
        print(f"    ... and {len(text_blocks) - 5} more text blocks")

    # Show table blocks
    table_blocks = [b for b in content_list if b["type"] == "table"]
    if table_blocks:
        print(f"\n  Table blocks ({len(table_blocks)} total):")
        for i, block in enumerate(table_blocks):
            caption = block.get("table_caption", [])
            has_body = bool(block.get("table_body"))
            print(f"    [{i}] caption={caption}, has_html_body={has_body}, page={block.get('page_idx')}")

    # Save summary
    summary = {
        "total_blocks": len(content_list),
        "type_distribution": type_counts,
        "total_pages": len(pages),
        "text_block_count": len(text_blocks),
        "table_block_count": len(table_blocks),
    }
    summary_path = output_dir / "parse_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print(f"\n  Summary saved to: {summary_path}")


# ---------------------------------------------------------------------------
# Main Pipeline
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("  MinerU Cloud API - MVP Pipeline")
    print("=" * 60)

    check_config()

    # Determine input file
    if len(sys.argv) > 1:
        input_file = Path(sys.argv[1])
    else:
        input_file = Path("test_sample.pdf")

    if not input_file.exists():
        print(f"[ERROR] File not found: {input_file}")
        print("  Run 'python create_test_pdf.py' first to generate test PDF.")
        sys.exit(1)

    print(f"  Input file: {input_file}")
    print(f"  Output dir: {OUTPUT_DIR}")

    # Execute pipeline
    batch_id, upload_url = request_upload_url(input_file.name)
    upload_file(input_file, upload_url)
    result = poll_results(batch_id)
    task_output_dir = download_results(result, OUTPUT_DIR)
    analyze_output(task_output_dir)

    print(f"\n{'='*60}")
    print("  MVP Pipeline completed successfully!")
    print(f"  Results saved to: {task_output_dir}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
