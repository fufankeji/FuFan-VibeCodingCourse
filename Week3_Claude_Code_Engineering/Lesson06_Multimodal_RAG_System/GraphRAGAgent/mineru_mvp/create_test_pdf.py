"""Generate a sample PDF for MinerU MVP testing."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER

OUTPUT_PATH = "test_sample.pdf"


def create_test_pdf():
    doc = SimpleDocTemplate(OUTPUT_PATH, pagesize=A4)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CustomTitle", parent=styles["Title"], fontSize=22, spaceAfter=20
    )
    h2_style = ParagraphStyle(
        "CustomH2", parent=styles["Heading2"], fontSize=16, spaceAfter=12
    )
    body_style = styles["BodyText"]

    elements = []

    # Title
    elements.append(Paragraph("GraphRAG: Knowledge Graph Enhanced RAG System", title_style))
    elements.append(Spacer(1, 0.5 * cm))

    # Section 1
    elements.append(Paragraph("1. Introduction", h2_style))
    elements.append(Paragraph(
        "GraphRAG is an advanced retrieval-augmented generation technique developed by "
        "Microsoft Research. It combines knowledge graphs with large language models to "
        "enable more accurate and contextually rich question answering over complex document "
        "collections. Unlike traditional RAG systems that rely solely on vector similarity "
        "search, GraphRAG constructs a hierarchical knowledge graph from source documents, "
        "enabling multi-hop reasoning and global summarization capabilities.",
        body_style,
    ))
    elements.append(Spacer(1, 0.3 * cm))

    # Section 2
    elements.append(Paragraph("2. Architecture Overview", h2_style))
    elements.append(Paragraph(
        "The GraphRAG pipeline consists of several key stages: (1) Document Parsing - raw "
        "documents are converted into structured text using tools like MinerU; (2) Entity "
        "Extraction - named entities and relationships are extracted using LLMs or specialized "
        "NLP models such as LangExtract; (3) Graph Construction - entities and relationships "
        "are organized into a knowledge graph with community detection; (4) Indexing - both "
        "vector embeddings and graph indices are built for hybrid retrieval; (5) Query Processing "
        "- user queries are decomposed and answered using graph traversal combined with LLM "
        "generation.",
        body_style,
    ))
    elements.append(Spacer(1, 0.3 * cm))

    # Section 3 with table
    elements.append(Paragraph("3. Performance Comparison", h2_style))
    elements.append(Paragraph(
        "The following table compares GraphRAG with traditional RAG approaches across "
        "several evaluation metrics on the NarrativeQA benchmark dataset:",
        body_style,
    ))
    elements.append(Spacer(1, 0.3 * cm))

    table_data = [
        ["Method", "Comprehensiveness", "Diversity", "Empowerment", "Overall"],
        ["Naive RAG", "32.4%", "15.8%", "28.6%", "25.6%"],
        ["HyDE RAG", "41.2%", "22.1%", "35.7%", "33.0%"],
        ["GraphRAG (Local)", "58.7%", "45.3%", "52.1%", "52.0%"],
        ["GraphRAG (Global)", "72.0%", "62.4%", "68.5%", "67.6%"],
    ]
    table = Table(table_data, colWidths=[3.5 * cm, 3.5 * cm, 3 * cm, 3 * cm, 3 * cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4472C4")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#D9E2F3")]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 0.3 * cm))

    # Section 4
    elements.append(Paragraph("4. Conclusion", h2_style))
    elements.append(Paragraph(
        "GraphRAG represents a significant advancement over traditional RAG approaches by "
        "leveraging the structural properties of knowledge graphs. The combination of entity "
        "extraction, community detection, and hierarchical summarization enables both local "
        "and global question answering capabilities. Our experiments demonstrate that GraphRAG "
        "achieves substantial improvements in comprehensiveness (72.0% vs 32.4%) and overall "
        "quality (67.6% vs 25.6%) compared to naive RAG baselines.",
        body_style,
    ))

    doc.build(elements)
    print(f"Test PDF created: {OUTPUT_PATH}")


if __name__ == "__main__":
    create_test_pdf()
