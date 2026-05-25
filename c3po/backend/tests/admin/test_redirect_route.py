import pytest
from admin.routes.redirect_route import router
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient

app = FastAPI()
app.include_router(router)
client = TestClient(app)


@pytest.mark.asyncio
class TestRedirectRoute:
    @pytest.fixture
    def patch_env(self, monkeypatch):
        monkeypatch.setenv("OKTA_TOKEN_ENDPOINT", "https://okta/token")
        monkeypatch.setenv("OKTA_USER_INFO_ENDPOINT", "https://okta/userinfo")
        monkeypatch.setenv("OKTA_REDIRECT_URI", "http://localhost/callback")
        monkeypatch.setenv("OKTA_CLIENT_ID", "client-id")
        monkeypatch.setenv("OKTA_CLIENT_SECRET", "client-secret")
        monkeypatch.setenv("CLIENT_BASE_URL", "http://localhost:3000")

    async def test_callback_success_admin(self, patch_env, mocker):
        mock_token_resp = mocker.MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {"access_token": "access-token"}
        mock_userinfo_resp = mocker.MagicMock()
        mock_userinfo_resp.status_code = 200
        mock_userinfo_resp.json.return_value = {"sub": "user1", "Groups": ["APP_genai_app_admin_user"]}
        mock_client = mocker.AsyncMock()
        mock_client.post.return_value = mock_token_resp
        mock_client.get.return_value = mock_userinfo_resp
        mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client)
        mocker.patch("httpx.AsyncClient.__aexit__", return_value=None)
        mocker.patch("admin.routes.redirect_route.user_in_group", return_value=True)
        mocker.patch("admin.routes.redirect_route.create_jwt", return_value="jwt-token")

        async with AsyncClient(base_url="http://test") as ac:
            response = await ac.get("/callback?code=authcode")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_callback_success_non_admin(patch_env, mocker):
        mock_token_resp = mocker.MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {"access_token": "access-token"}

        mock_userinfo_resp = mocker.MagicMock()
        mock_userinfo_resp.status_code = 200
        mock_userinfo_resp.json.return_value = {
            "sub": "user1",
            "Groups": ["APP_genai_app_user"]
        }

        mock_client = mocker.AsyncMock()
        mock_client.post.return_value = mock_token_resp
        mock_client.get.return_value = mock_userinfo_resp

        mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client)
        mocker.patch("httpx.AsyncClient.__aexit__", return_value=None)
        mocker.patch("admin.routes.redirect_route.user_in_group", return_value=False)

        async with AsyncClient(base_url="http://test") as ac:
            response = await ac.get("/callback?code=authcode")

        assert response.status_code == 200

    def test_callback_missing_code(self, patch_env):
        response = client.get("/callback")
        assert response.status_code == 400
        assert "Authorization code missing" in response.json()["detail"]

    def test_callback_token_exchange_failure(self, patch_env, mocker):
        mock_token_resp = mocker.MagicMock()
        mock_token_resp.status_code = 401
        mock_client = mocker.AsyncMock()
        mock_client.post.return_value = mock_token_resp
        mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client)
        mocker.patch("httpx.AsyncClient.__aexit__", return_value=None)

        response = client.get("/callback?code=authcode")
        assert response.status_code == 401
        assert "Token exchange failed" in response.json()["detail"]

    def test_callback_userinfo_failure(self, patch_env, mocker):
        mock_token_resp = mocker.MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {"access_token": "access-token"}
        mock_userinfo_resp = mocker.MagicMock()
        mock_userinfo_resp.status_code = 401
        mock_client = mocker.AsyncMock()
        mock_client.post.return_value = mock_token_resp
        mock_client.get.return_value = mock_userinfo_resp
        mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client)
        mocker.patch("httpx.AsyncClient.__aexit__", return_value=None)

        response = client.get("/callback?code=authcode")
        assert response.status_code == 401
        assert "Failed to fetch user info" in response.json()["detail"]
