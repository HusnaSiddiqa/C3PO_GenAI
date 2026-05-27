import time
from google.genai import errors as genai_errors

# Try models in order until one succeeds
MODEL_FALLBACKS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

MAX_RETRIES = 3
BASE_DELAY = 2.0


def generate(client, contents: str, primary_model: str = MODEL_FALLBACKS[0]) -> str:
    """Call Gemini with automatic retry and model fallback on 503/429."""
    models = [primary_model] + [m for m in MODEL_FALLBACKS if m != primary_model]

    for model_id in models:
        for attempt in range(MAX_RETRIES):
            try:
                response = client.models.generate_content(model=model_id, contents=contents)
                return response.text
            except genai_errors.ServerError as e:
                # 503 high demand — retry same model twice, then fall back
                if attempt < MAX_RETRIES - 1:
                    time.sleep(BASE_DELAY * (attempt + 1))
                    continue
                # Exhausted retries on this model, try next
                break
            except genai_errors.ClientError as e:
                if e.status_code == 429:
                    # Rate limited — wait longer and retry
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(BASE_DELAY * (attempt + 2))
                        continue
                    break
                raise  # Other 4xx errors are real failures

    raise RuntimeError(
        "Gemini is currently overloaded. Please wait a moment and try again."
    )
