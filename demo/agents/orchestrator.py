import json
from agents.llm_utils import generate

AGENT_DESCRIPTIONS = {
    "general": "Handles general Q&A, factual questions, explanations, and chit-chat",
    "document": "Analyzes uploaded documents and answers questions about their content",
    "data_analysis": "Analyzes data, creates charts, performs calculations, and interprets numbers",
    "creative": "Creative writing, brainstorming, ideation, storytelling, and open-ended tasks",
}

AGENT_ICONS = {
    "general": "💬",
    "document": "📄",
    "data_analysis": "📊",
    "creative": "✨",
}


def classify_intent(query: str, has_document: bool, client) -> tuple[str, str]:
    agents_info = "\n".join(f"- {k}: {v}" for k, v in AGENT_DESCRIPTIONS.items())
    doc_note = (
        "\nIMPORTANT: The user has uploaded a document. Prefer 'document' agent if the query relates to it."
        if has_document
        else ""
    )

    prompt = f"""You are a query router that selects the most appropriate agent for a user query.

Available agents:
{agents_info}{doc_note}

User query: "{query}"

Respond with ONLY valid JSON (no markdown, no code blocks):
{{"agent": "agent_name", "reason": "one short sentence"}}"""

    try:
        text = generate(client, prompt).strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text.strip())
        agent = result.get("agent", "general")
        if agent not in AGENT_DESCRIPTIONS:
            agent = "general"
        return agent, result.get("reason", "Matched by intent")
    except Exception:
        return "general", "Defaulted to general agent"
