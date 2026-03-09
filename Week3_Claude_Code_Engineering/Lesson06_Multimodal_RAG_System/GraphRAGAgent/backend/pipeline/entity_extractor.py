"""
Entity Extractor — LangExtract + DeepSeek entity extraction.
Independent implementation for the GraphRAG Studio backend.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

import langextract as lx
from langextract.providers.openai import OpenAILanguageModel

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

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

EXAMPLES = [
    lx.data.ExampleData(
        text=(
            "LangChain is a framework created by Harrison Chase for building "
            "LLM applications. It integrates with OpenAI models and Pinecone "
            "vector database for semantic search."
        ),
        extractions=[
            lx.data.Extraction(extraction_class="TECHNOLOGY", extraction_text="LangChain"),
            lx.data.Extraction(extraction_class="PERSON", extraction_text="Harrison Chase"),
            lx.data.Extraction(extraction_class="CONCEPT", extraction_text="LLM applications"),
            lx.data.Extraction(extraction_class="TECHNOLOGY", extraction_text="OpenAI models"),
            lx.data.Extraction(extraction_class="TECHNOLOGY", extraction_text="Pinecone"),
            lx.data.Extraction(extraction_class="CONCEPT", extraction_text="semantic search"),
        ],
    )
]


def create_model() -> OpenAILanguageModel:
    if not DEEPSEEK_API_KEY:
        raise ValueError("DEEPSEEK_API_KEY not set in backend/.env")
    return OpenAILanguageModel(
        model_id=MODEL_ID,
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
    )


def extract_entities(page_text: str, model: OpenAILanguageModel) -> lx.data.AnnotatedDocument:
    return lx.extract(
        text_or_documents=page_text,
        prompt_description=PROMPT_DESCRIPTION,
        examples=EXAMPLES,
        model=model,
        show_progress=False,
    )
