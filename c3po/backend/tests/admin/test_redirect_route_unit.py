from unittest.mock import patch, MagicMock, AsyncMock

import pytest
from fastapi import HTTPException
from starlette.responses import RedirectResponse


class DummyRequest:
    def __init__(self, code=None):
        self.query_params = {"code": code} if code else {}


class TestRedirectRouteLogic:
    @patch('admin.routes.redirect_route.OKTA_TOKEN_URL', 'https://okta/token')
    @patch('admin.routes.redirect_route.OKTA_USERINFO_URL', 'https://okta/userinfo')
    @patch('admin.routes.redirect_route.OKTA_REDIRECT_URI', 'http://localhost/callback')
    @patch('admin.routes.redirect_route.OKTA_CLIENT_ID', 'client-id')
    @patch('admin.routes.redirect_route.OKTA_CLIENT_SECRET', 'client-secret')
    @patch('admin.routes.redirect_route.CLIENT_BASE_URL', 'http://localhost:3000')
    @patch('admin.routes.redirect_route.ADMIN_GROUP', 'admin-group')
    @patch('admin.routes.redirect_route.USER_GROUP', 'user-group')
    @patch('admin.routes.redirect_route.user_in_group')
    @patch('admin.routes.redirect_route.create_jwt')
    @patch('admin.routes.redirect_route.httpx.AsyncClient')
    @pytest.mark.asyncio
    async def test_callback_success_admin(
        self, mock_async_client, mock_create_jwt, mock_user_in_group
    ):
        # Create async mocks for HTTP responses
        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {"access_token": "access-token"}
        # Mock userinfo
        mock_userinfo_resp = MagicMock()
        mock_userinfo_resp.status_code = 200
        mock_userinfo_resp.json.return_value = {"sub": "user1", "Groups": ["admin-group"]}
        # AsyncClient context manager
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_token_resp
        mock_client_instance.get.return_value = mock_userinfo_resp
        mock_async_client.return_value.__aenter__.return_value = mock_client_instance

        mock_user_in_group.return_value = True
        mock_create_jwt.return_value = "jwt-token"

        from admin.routes.redirect_route import callback
        request = DummyRequest(code="authcode")
        response = await callback(request)
        assert isinstance(response, RedirectResponse)
        assert "token=jwt-token" in response.headers["location"]

    @patch('admin.routes.redirect_route.user_in_group')
    @patch('admin.routes.redirect_route.httpx.AsyncClient')
    @pytest.mark.asyncio
    async def test_callback_success_non_admin(self, mock_async_client, mock_user_in_group):
        # Mock token exchange
        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {"access_token": "access-token"}
        # Mock userinfo
        mock_userinfo_resp = MagicMock()
        mock_userinfo_resp.status_code = 200
        mock_userinfo_resp.json.return_value = {"sub": "user1", "Groups": ["other-group"]}
        # AsyncClient context manager
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_token_resp
        mock_client_instance.get.return_value = mock_userinfo_resp
        mock_async_client.return_value.__aenter__.return_value = mock_client_instance

        mock_user_in_group.return_value = False

        from admin.routes.redirect_route import callback, CLIENT_BASE_URL
        request = DummyRequest(code="authcode")
        response = await callback(request)
        assert isinstance(response, RedirectResponse)
        assert response.headers["location"].startswith(f"{CLIENT_BASE_URL}/callback?error=403")

    @pytest.mark.asyncio
    async def test_callback_missing_code(self):
        from admin.routes.redirect_route import callback
        request = DummyRequest(code=None)
        with pytest.raises(HTTPException) as exc_info:
            await callback(request)
        assert exc_info.value.status_code == 400
        assert "Authorization code missing" in str(exc_info.value.detail)

    @patch('admin.routes.redirect_route.httpx.AsyncClient')
    @pytest.mark.asyncio
    async def test_callback_token_exchange_failure(self, mock_async_client):
        # Mock token exchange failure
        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 401
        mock_async_client.return_value.__aenter__.return_value.post.return_value = mock_token_resp

        from admin.routes.redirect_route import callback
        request = DummyRequest(code="authcode")
        with pytest.raises(HTTPException) as exc_info:
            await callback(request)
        assert exc_info.value.status_code == 401
        assert "Token exchange failed" in str(exc_info.value.detail)

    @patch('admin.routes.redirect_route.httpx.AsyncClient')
    @pytest.mark.asyncio
    async def test_callback_userinfo_failure(self, mock_async_client):
        # Mock token exchange
        mock_token_resp = MagicMock()
        mock_token_resp.status_code = 200
        mock_token_resp.json.return_value = {"access_token": "access-token"}
        # Mock userinfo failure
        mock_userinfo_resp = MagicMock()
        mock_userinfo_resp.status_code = 401
        # AsyncClient context manager
        mock_client_instance = AsyncMock()
        mock_client_instance.post.return_value = mock_token_resp
        mock_client_instance.get.return_value = mock_userinfo_resp
        mock_async_client.return_value.__aenter__.return_value = mock_client_instance

        from admin.routes.redirect_route import callback
        request = DummyRequest(code="authcode")
        with pytest.raises(HTTPException) as exc_info:
            await callback(request)
        assert exc_info.value.status_code == 401
        assert "Failed to fetch user info" in str(exc_info.value.detail)
