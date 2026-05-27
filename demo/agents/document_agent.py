import io
from agents.llm_utils import generate

MAX_DOC_CHARS = 30000


def extract_text(uploaded_file) -> str:
    if uploaded_file.type == "application/pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(uploaded_file.read()))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            return f"Could not extract PDF text: {e}"
    else:
        return uploaded_file.read().decode("utf-8", errors="ignore")


def document_agent_response(
    query: str, document_text: str, client, history: list
) -> tuple[str, None, None]:
    doc_excerpt = document_text[:MAX_DOC_CHARS]
    if len(document_text) > MAX_DOC_CHARS:
        doc_excerpt += "\n\n[Document truncated — showing first 30,000 characters]"

    history_text = ""
    if len(history) > 1:
        recent = history[:-1][-4:]
        lines = "\n".join(f"{m['role'].title()}: {m['content']}" for m in recent)
        history_text = f"\nPrevious conversation:\n{lines}\n"

    prompt = f"""You are a document analysis assistant. Answer questions using only the provided document.

DOCUMENT:
{doc_excerpt}
{history_text}
USER QUESTION: {query}

Provide a clear, accurate answer based on the document. Quote relevant passages when helpful. If the answer is not in the document, say so."""

    return generate(client, prompt), None, None
