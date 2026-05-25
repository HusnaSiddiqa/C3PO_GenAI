import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { decodeToken } from "../sso/decodeToken";

const ProtectedRoute: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    if (storedToken) {
      const decoded = decodeToken(storedToken);
      const now = Math.floor(Date.now() / 1000);
      if (decoded && decoded.exp && now < decoded.exp) {
        setIsLoading(false);
        return;
      }
      localStorage.removeItem("authToken");
    }
    sessionStorage.setItem("redirectAfterLogin", window.location.href);
    window.location.href = "/login";
  }, [location.pathname]); // <-- runs on every navigation

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", marginTop: "25%" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
