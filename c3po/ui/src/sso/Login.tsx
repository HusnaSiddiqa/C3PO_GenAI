import React, { useEffect } from "react";
import { useConfig } from "../contexts/ConfigContext";

const Login: React.FC = () => {
  const { config } = useConfig();
  useEffect(() => {
    // Auto-redirect to Okta immediately when component loads
    const state = Math.random().toString(36).substring(7);
    const nonce = Math.random().toString(36).substring(7);

    const authUrl =
      `${config.okta_auth_url}?` +
      `client_id=${config.okta_client_id}&` +
      `response_type=code&` +
      `scope=openid profile email groups&` +
      `redirect_uri=${config.okta_redirect_uri}&` +
      `state=${state}&` +
      `nonce=${nonce}`;

    window.location.href = authUrl;
  }, [
    config.okta_auth_url,
    config.okta_client_id,
    config.okta_redirect_uri
  ]);

  return (
    <div style={{ textAlign: "center", marginTop: "25%" }}>
      <p>Redirecting to login...</p>
    </div>
  );
};

export default Login;
