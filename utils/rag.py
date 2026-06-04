import json
from utils.retriever import retrieve_chunks
from utils.llmclient import llm

def build_context(documents):
    return "\n\n".join(
        doc.page_content
        for doc in documents
    )

def ask_question(q: str, document_id: str):
    docs = retrieve_chunks(q, document_id, k=5)
    sources = []
    for i, doc in enumerate(docs):
        page = doc.metadata.get("page", None)
        preview = doc.page_content[:150].strip()
        sources.append({"index": i + 1, "page": page, "preview": preview})

    yield json.dumps({"type": "sources", "sources": sources}) + "\n"

    context = build_context(docs)
    prompt = f"""
You are a helpful assistant.

Answer ONLY using the provided context.

If the answer is not present in the context, say:
"I couldn't find that information in the document."

When referencing information, cite the source index like [1], [2] etc.

Context:
{context}

Question:
{q}
"""

    for chunk in llm.stream(prompt):
        if chunk.content:
            yield json.dumps({"type": "text", "content": chunk.content}) + "\n"

    yield json.dumps({"type": "done"}) + "\n"