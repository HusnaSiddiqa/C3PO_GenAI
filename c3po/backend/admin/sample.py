from fastapi import FastAPI
import requests

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "healthy"}

@app.get("/admin")
async def root():
    resp = requests.get("http://commercial-us-sbx-iidd-genai-chat-mgr:8001")
    return {"message": "admin", "data": resp.json()}