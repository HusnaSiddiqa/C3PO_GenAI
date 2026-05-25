from fastapi import FastAPI
import os
from .routes.chat_routes import router as chat_router
from .routes.conversation_routes import router as conversation_router
from .routes.feedback_routes import router as feedback_router
from utils.constants import API_VERSION_PREFIX

app = FastAPI()

app.include_router(chat_router, prefix=f"{API_VERSION_PREFIX}/chat", tags=["Chat"])
app.include_router(conversation_router, prefix=f"{API_VERSION_PREFIX}/conversation", tags=["Conversation"])
app.include_router(feedback_router, prefix=f"{API_VERSION_PREFIX}/feedback", tags=["Feedback"])

if os.getenv("VITE_ENABLE_SOURCE_SELECTOR", "false").lower() == "true":
    from .routes._sources import router as sources_router
    app.include_router(sources_router, prefix=f"{API_VERSION_PREFIX}/chat", tags=["Sources"])

@app.get("/")
async def root():
    return {"message": "chat manager"}
