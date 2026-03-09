"""
LangExtract MVP Test — DeepSeek via OpenAI Provider
=====================================================
Tests the complete extraction pipeline: text input → LLM extraction → structured output

Usage:
    python mvp_test_deepseek.py
"""

import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

import langextract as lx
from langextract.providers.openai import OpenAILanguageModel

load_dotenv(override=True)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEEPSEEK_API_KEY = "sk-55cb39b8a3284355bc80217c11c85d1f"
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
MODEL_ID = "deepseek-chat"

OUTPUT_DIR = Path("mvp_output")
OUTPUT_DIR.mkdir(exist_ok=True)


def print_header(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def print_extractions(extractions: list[lx.data.Extraction]):
    """Print extraction results in detail."""
    if not extractions:
        print("  No extractions found.")
        return

    # Count by class
    class_counts = {}
    for ext in extractions:
        class_counts[ext.extraction_class] = class_counts.get(ext.extraction_class, 0) + 1

    print(f"  Total extractions: {len(extractions)}")
    print(f"  By type:")
    for cls, count in sorted(class_counts.items()):
        print(f"    {cls}: {count}")

    print(f"\n  Details:")
    for i, ext in enumerate(extractions):
        ci = ext.char_interval
        align = ext.alignment_status.value if ext.alignment_status else "N/A"
        print(f"    [{i}] class={ext.extraction_class}")
        print(f"         text=\"{ext.extraction_text}\"")
        print(f"         char_interval=[{ci.start_pos}, {ci.end_pos}]" if ci else "         char_interval=None")
        print(f"         alignment={align}")
        if ext.attributes:
            print(f"         attributes={ext.attributes}")


# ---------------------------------------------------------------------------
# Test: GraphRAG-related entity extraction (matches project domain)
# ---------------------------------------------------------------------------
def test_graphrag_entity_extraction():
    """Extract technology entities from a GraphRAG-related text."""
    print_header("Test: GraphRAG Entity Extraction (DeepSeek)")

    input_text = (
        "GraphRAG is an advanced retrieval-augmented generation system developed by "
        "Microsoft Research. It combines knowledge graphs with large language models "
        "like GPT-4 to enable multi-hop reasoning. The system uses community detection "
        "algorithms such as Leiden clustering on the constructed graph. Key components "
        "include MinerU for document parsing, LangExtract for entity extraction, and "
        "Neo4j as the graph database backend. The pipeline processes PDF documents "
        "through OCR and NLP stages before building the knowledge graph."
    )

    prompt_description = (
        "Extract named entities from the text in order of appearance. "
        "Entity types: TECHNOLOGY (software, algorithms, models), "
        "ORGANIZATION (companies, research groups), "
        "CONCEPT (technical concepts, methodologies)."
    )

    examples = [
        lx.data.ExampleData(
            text=(
                "LangChain is a framework created by Harrison Chase for building "
                "LLM applications. It integrates with OpenAI models and Pinecone "
                "vector database for semantic search."
            ),
            extractions=[
                lx.data.Extraction(
                    extraction_class="TECHNOLOGY",
                    extraction_text="LangChain",
                ),
                lx.data.Extraction(
                    extraction_class="ORGANIZATION",
                    extraction_text="Harrison Chase",
                ),
                lx.data.Extraction(
                    extraction_class="CONCEPT",
                    extraction_text="LLM applications",
                ),
                lx.data.Extraction(
                    extraction_class="TECHNOLOGY",
                    extraction_text="OpenAI models",
                ),
                lx.data.Extraction(
                    extraction_class="TECHNOLOGY",
                    extraction_text="Pinecone",
                ),
                lx.data.Extraction(
                    extraction_class="CONCEPT",
                    extraction_text="semantic search",
                ),
            ],
        )
    ]

    print(f"  Input text: {input_text[:80]}...")
    print(f"  Model: {MODEL_ID} (explicit OpenAI Provider → DeepSeek)")
    print(f"  Base URL: {DEEPSEEK_BASE_URL}")
    print(f"\n  Extracting...")

    start_time = time.time()

    # Directly instantiate OpenAI provider with DeepSeek config
    # to bypass model_id-based routing (which would route "deepseek-*" to Ollama)
    model = OpenAILanguageModel(
        model_id=MODEL_ID,
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
    )

    result = lx.extract(
        text_or_documents=input_text,
        prompt_description=prompt_description,
        examples=examples,
        model=model,
        show_progress=True,
    )

    elapsed = time.time() - start_time
    print(f"\n  Completed in {elapsed:.1f}s")

    print(f"\n  --- Extraction Results ---")
    print_extractions(result.extractions)

    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print_header("LangExtract MVP Test — DeepSeek via OpenAI Provider")
    print(f"  Model ID: {MODEL_ID}")
    print(f"  DeepSeek Base URL: {DEEPSEEK_BASE_URL}")
    print(f"  Output Dir: {OUTPUT_DIR}")

    result = test_graphrag_entity_extraction()

    # Save results
    print_header("Saving Results")

    # Save JSONL
    jsonl_file = "graphrag_entities.jsonl"
    lx.io.save_annotated_documents(
        [result], output_name=jsonl_file, output_dir=str(OUTPUT_DIR)
    )
    print(f"  Saved: {OUTPUT_DIR / jsonl_file}")

    # Save JSON summary
    summary = {
        "total_extractions": len(result.extractions),
        "extraction_classes": {},
        "extractions": [],
    }
    for ext in result.extractions:
        cls = ext.extraction_class
        summary["extraction_classes"][cls] = summary["extraction_classes"].get(cls, 0) + 1
        summary["extractions"].append({
            "class": ext.extraction_class,
            "text": ext.extraction_text,
            "char_start": ext.char_interval.start_pos if ext.char_interval else None,
            "char_end": ext.char_interval.end_pos if ext.char_interval else None,
            "alignment": ext.alignment_status.value if ext.alignment_status else None,
        })

    summary_path = OUTPUT_DIR / "extraction_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    print(f"  Saved: {summary_path}")

    print_header("MVP Test Complete")
    print(f"  Total extractions: {len(result.extractions)}")
    print(f"  Results saved to: {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
