from agents.llm_utils import generate

SYSTEM_PROMPTS = {
    "general": "You are a helpful, knowledgeable assistant. Be clear, accurate, and concise.",
    "creative": "You are a creative assistant. Be imaginative, inspiring, and engaging. Think outside the box.",
}


def _build_history_text(history: list) -> str:
    if len(history) <= 1:
        return ""
    recent = history[:-1][-6:]
    lines = "\n".join(f"{m['role'].title()}: {m['content']}" for m in recent)
    return f"\nConversation history:\n{lines}\n"


def general_agent_response(query: str, client, history: list, agent_type: str) -> tuple[str, None, None]:
    system = SYSTEM_PROMPTS.get(agent_type, SYSTEM_PROMPTS["general"])
    history_text = _build_history_text(history)
    prompt = f"{system}{history_text}\nUser: {query}\nAssistant:"
    return generate(client, prompt), None, None
