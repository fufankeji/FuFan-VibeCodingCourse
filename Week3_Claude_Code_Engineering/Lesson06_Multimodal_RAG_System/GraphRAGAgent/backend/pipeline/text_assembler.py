"""
Text Assembler — MinerU content_list.json → per-page plain text.
Independent implementation for the GraphRAG Studio backend.
"""
from __future__ import annotations

import dataclasses
import json
from collections import defaultdict
from pathlib import Path

from bs4 import BeautifulSoup


@dataclasses.dataclass
class BlockSpan:
    block_index: int
    block_type: str
    page_idx: int
    char_start: int
    char_end: int
    bbox: list


@dataclasses.dataclass
class PageText:
    page_idx: int
    text: str
    block_spans: list[BlockSpan]


def html_table_to_text(table_body: str) -> str:
    soup = BeautifulSoup(table_body, "html.parser")
    rows = []
    for tr in soup.find_all("tr"):
        cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        rows.append(" | ".join(cells))
    return "\n".join(rows)


def load_content_list(path: Path) -> list[dict]:
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

            if block_type == "text":
                block_text = block.get("text", "").rstrip()
            elif block_type == "table":
                table_body = block.get("table_body", "")
                block_text = html_table_to_text(table_body) if table_body else ""
            else:
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
            buffer.append("\n")
            cursor += 1

        text = "".join(buffer).rstrip("\n")
        result.append(PageText(page_idx=page_idx, text=text, block_spans=spans))

    return result


def count_blocks_by_type(content_list: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for block in content_list:
        counts[block.get("type", "unknown")] += 1
    return dict(counts)
