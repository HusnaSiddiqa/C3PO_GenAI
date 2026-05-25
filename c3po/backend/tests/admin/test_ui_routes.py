from fastapi import FastAPI
from fastapi.testclient import TestClient

from admin.routes.ui_routes import router


def test_ui_config_returns_env_values(monkeypatch):
    monkeypatch.setenv("VITE_ADMIN_AD_GROUP", "admin_group")
    monkeypatch.setenv("VITE_APP_DEFAULT_USER_ID", "user123")
    monkeypatch.setenv("VITE_APP_TITLE", "Test App")
    monkeypatch.setenv("VITE_OKTA_AUTH_URL", "https://okta.example.com/auth")
    monkeypatch.setenv("VITE_OKTA_CLIENT_ID", "client_id")
    monkeypatch.setenv("VITE_OKTA_REDIRECT_URI", "https://app.example.com/callback")
    monkeypatch.setenv("VITE_SUPPORT_EMAIL", "support@example.com")
    monkeypatch.setenv("VITE_ADMIN_SECRET", "admin_secret")
    monkeypatch.setenv("VITE_CHAT_MGR_SECRET", "chat_secret")

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.get("/config")
    assert response.status_code == 200
    data = response.json()
    assert data["admin_ad_group"] == "admin_group"
    assert data["app_default_user_id"] == "user123"
    assert data["app_title"] == "Test App"
    assert data["okta_auth_url"] == "https://okta.example.com/auth"
    assert data["okta_client_id"] == "client_id"
    assert data["okta_redirect_uri"] == "https://app.example.com/callback"
    assert data["support_email"] == "support@example.com"
    assert data["admin_secret"] == "admin_secret"
    assert data["chat_mgr_secret"] == "chat_secret"


def test_ui_config_defaults_when_env_missing(monkeypatch):
    monkeypatch.delenv("VITE_ADMIN_AD_GROUP", raising=False)
    monkeypatch.delenv("VITE_APP_DEFAULT_USER_ID", raising=False)
    monkeypatch.delenv("VITE_APP_TITLE", raising=False)
    monkeypatch.delenv("VITE_OKTA_AUTH_URL", raising=False)
    monkeypatch.delenv("VITE_OKTA_CLIENT_ID", raising=False)
    monkeypatch.delenv("VITE_OKTA_REDIRECT_URI", raising=False)
    monkeypatch.delenv("VITE_SUPPORT_EMAIL", raising=False)
    monkeypatch.delenv("VITE_ADMIN_SECRET", raising=False)
    monkeypatch.delenv("VITE_CHAT_MGR_SECRET", raising=False)

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.get("/config")
    assert response.status_code == 200
    data = response.json()
    assert data["admin_ad_group"] == ""
    assert data["app_default_user_id"] == ""
    assert data["app_title"] == ""
    assert data["okta_auth_url"] == ""
    assert data["okta_client_id"] == ""
    assert data["okta_redirect_uri"] == ""
    assert data["support_email"] == ""
    assert data["admin_secret"] == ""
    assert data["chat_mgr_secret"] == ""
