"""
Entity Extractor — LangExtract wrapper for DeepSeek-based extraction
======================================================================
Configures model, prompt, and examples for GraphRAG entity extraction.
"""

import os

from dotenv import load_dotenv

import langextract as lx
from langextract.providers.openai import OpenAILanguageModel

load_dotenv(override=True)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
MODEL_ID = "deepseek-chat"

PROMPT_DESCRIPTION = (
    "Extract named entities from the text in order of appearance. "
    "Entity types: TECHNOLOGY (software, algorithms, models, tools), "
    "ORGANIZATION (companies, research groups, institutions), "
    "PERSON (individual people), "
    "LOCATION (places, geographic entities), "
    "CONCEPT (technical concepts, methodologies, frameworks)."
)

# Few-shot example — validated in MVP test (94.1% match_exact)
EXAMPLES = [
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
                extraction_class="PERSON",
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


def create_model() -> OpenAILanguageModel:
    """Create a DeepSeek model instance via OpenAI Provider."""
    if not DEEPSEEK_API_KEY:
        raise ValueError("DEEPSEEK_API_KEY not set in .env")
    return OpenAILanguageModel(
        model_id=MODEL_ID,
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
    )


def extract_entities(
    page_text: str,
    model: OpenAILanguageModel,
) -> lx.data.AnnotatedDocument:
    """Run LangExtract entity extraction on a page's text."""
    return lx.extract(
        text_or_documents=page_text,
        prompt_description=PROMPT_DESCRIPTION,
        examples=EXAMPLES,
        model=model,
        show_progress=True,
    )
