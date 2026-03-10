"""
Text Assembler — MinerU content_list.json → per-page plain text
================================================================
Converts MinerU structured blocks into plain text suitable for LangExtract,
while tracking character offsets for provenance mapping.
"""

import dataclasses
import json
from collections import defaultdict
from pathlib import Path

from bs4 import BeautifulSoup


@dataclasses.dataclass
class BlockSpan:
    """Tracks where a MinerU block lands in the assembled text."""
    block_index: int    # index in content_list array
    block_type: str     # "text" | "table"
    page_idx: int
    char_start: int     # start offset in assembled page text
    char_end: int       # end offset in assembled page text (exclusive)
    bbox: list[int]     # original bbox from MinerU


@dataclasses.dataclass
class PageText:
    """Assembled text for one page with provenance."""
    page_idx: int
    text: str
    block_spans: list[BlockSpan]


def html_table_to_text(table_body: str) -> str:
    """Convert HTML table to pipe-delimited plain text."""
    soup = BeautifulSoup(table_body, "html.parser")
    rows = []
    for tr in soup.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        rows.append(" | ".join(cells))
    return "\n".join(rows)


def load_content_list(path: Path) -> list[dict]:
    """Load content_list.json from a path or glob pattern."""
    if path.is_dir():
        matches = list(path.glob("*_content_list.json"))
        if not matches:
            matches = list(path.glob("*content_list.json"))
        if not matches:
            raise FileNotFoundError(f"No content_list.json found in {path}")
        path = matches[0]
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def assemble_pages(content_list: list[dict]) -> list[PageText]:
    """Assemble MinerU blocks into per-page plain text with offset tracking.

    Args:
        content_list: Array of blocks from content_list.json

    Returns:
        List of PageText objects, one per page.
    """
    # Group blocks by page, preserving order
    pages: dict[int, list[tuple[int, dict]]] = defaultdict(list)
    for i, block in enumerate(content_list):
        page_idx = block.get("page_idx", 0)
        pages[page_idx].append((i, block))

    result = []
    for page_idx in sorted(pages.keys()):
        blocks = pages[page_idx]
        buffer = []
        spans = []
        cursor = 0

        for block_index, block in blocks:
            block_type = block.get("type", "unknown")
            bbox = block.get("bbox", [0, 0, 0, 0])

            # Extract plain text based on block type
            if block_type == "text":
                block_text = block.get("text", "").rstrip()
            elif block_type == "table":
                table_body = block.get("table_body", "")
                block_text = html_table_to_text(table_body) if table_body else ""
            else:
                # Skip unknown block types (image, equation, etc.)
                continue

            if not block_text:
                continue

            char_start = cursor
            buffer.append(block_text)
            cursor += len(block_text)
            char_end = cursor

            spans.append(BlockSpan(
                block_index=block_index,
                block_type=block_type,
                page_idx=page_idx,
                char_start=char_start,
                char_end=char_end,
                bbox=bbox,
            ))

            # Add newline separator between blocks
            buffer.append("\n")
            cursor += 1

        # Join and strip trailing newline
        text = "".join(buffer).rstrip("\n")

        result.append(PageText(
            page_idx=page_idx,
            text=text,
            block_spans=spans,
        ))

    return result


def find_source_block(char_pos: int, block_spans: list[BlockSpan]) -> BlockSpan | None:
    """Find which block a character position falls in."""
    for span in block_spans:
        if span.char_start <= char_pos < span.char_end:
            return span
    return None


# ---------------------------------------------------------------------------
# Standalone test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        input_path = Path(sys.argv[1])
    else:
        input_path = Path(__file__).parent.parent / "mineru_mvp" / "output" / "test_sample"

    content_list = load_content_list(input_path)
    print(f"Loaded {len(content_list)} blocks")

    pages = assemble_pages(content_list)
    for page in pages:
        print(f"\n--- Page {page.page_idx} ({len(page.text)} chars, {len(page.block_spans)} blocks) ---")
        for span in page.block_spans:
            preview = page.text[span.char_start:span.char_end][:60]
            print(f"  [{span.block_index}] {span.block_type:6s} [{span.char_start:4d}-{span.char_end:4d}] {preview}...")
        print(f"\nFull text:\n{page.text[:500]}...")
