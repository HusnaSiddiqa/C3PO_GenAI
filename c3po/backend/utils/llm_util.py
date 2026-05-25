import os
from typing import Any, Type, TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

_PROVIDER = os.getenv("PROVIDER", "mosaic").lower()


def extract_text(llm_result: Any) -> str:
    """Return plain text from an AIMessage regardless of provider.

    Mosaic/OpenAI  → content is a str.
    Bedrock/Claude → content is a list of typed blocks, e.g.
                     [{"type": "text", "text": "..."}].
    """
    content = llm_result.content if hasattr(llm_result, "content") else str(llm_result)
    if isinstance(content, list):
        return " ".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        ).strip()
    return content.strip()


def invoke_structured(llm: Any, schema: Type[T], prompt: Any) -> T:
    """Invoke the LLM and return a parsed Pydantic object.

    Both providers return the Pydantic model directly from
    with_structured_output — Mosaic via JSON schema / function calling,
    Bedrock via tool_use.  This wrapper makes the call site uniform and
    keeps provider-specific edge-case handling in one place.
    """
    return llm.with_structured_output(schema).invoke(prompt)


async def ainvoke_structured(llm: Any, schema: Type[T], prompt: Any) -> T:
    """Async version of invoke_structured."""
    result = await llm.with_structured_output(schema).ainvoke(prompt)
    return result


def invoke_text(llm: Any, prompt: Any) -> str:
    """Invoke the LLM and return a plain-text string.

    Handles the content shape difference between providers so callers
    never need to branch on PROVIDER themselves.
    """
    return extract_text(llm.invoke(prompt))


async def ainvoke_text(llm: Any, prompt: Any, **kwargs) -> str:
    """Async version of invoke_text."""
    result = await llm.ainvoke(prompt, **kwargs)
    return extract_text(result)
