import base64
import hashlib
import os

from fastapi import FastAPI
from utils.constants import API_VERSION_ADMIN_PREFIX

from .routes.admin_feedback_routes import router as admin_feedback_router  # Fixed this line
from .routes.admin_routes import router as admin_router
from .routes.redirect_route import router as redirect_router
from .routes.schema_config_routes import router as schema_config_router
from .routes.admin_clickable_routes import router as admin_clickable_router
from .routes.benchmark_routes import router as admin_benchmark_router
from .routes.ui_routes import router as ui_routes_router

app = FastAPI()
app.include_router(admin_router, prefix=f"{API_VERSION_ADMIN_PREFIX}/settings", tags=["settings"])
app.include_router(admin_feedback_router, prefix=f"{API_VERSION_ADMIN_PREFIX}/feedback", tags=["Admin Feedback"])
app.include_router(schema_config_router, prefix=f"{API_VERSION_ADMIN_PREFIX}/schema", tags=["Schema Config"])
app.include_router(admin_clickable_router, prefix=f"{API_VERSION_ADMIN_PREFIX}/clickable", tags=["Admin Clickable Questions"])
app.include_router(admin_benchmark_router, prefix=f"{API_VERSION_ADMIN_PREFIX}", tags=["Admin Benchmark"])
app.include_router(ui_routes_router, prefix=f"{API_VERSION_ADMIN_PREFIX}/ui", tags=["UI"])
app.include_router(redirect_router, prefix="/auth/oauth/okta", tags=["Okta Auth"])


@app.get("/")
async def root():
    return {"message": "admin"}