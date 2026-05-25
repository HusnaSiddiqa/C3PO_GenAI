import { useEffect, useState, useContext } from "react";
import { useSearchParams } from "react-router-dom";
import { decodeToken } from "../sso/decodeToken";
import { UserContext } from "../contexts/UserContext"; // Assuming you have a UserContext defined
import { useNavigate } from "react-router-dom";
import React from "react";
import { useConfig } from "../contexts/ConfigContext";

export default function CallbackPage() {
  const { config } = useConfig();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<string>("Initializing...");
  const { setUser } = useContext(UserContext); // Access UserContext
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = async () => {
      try {
        setStep("🔍 Checking authentication parameters...");
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
        // Check if this is an error from Okta
        const errorParam = searchParams.get("error");
        if (errorParam) {
          if (errorParam === "403") {
            navigate("/access-denied");
            return;
          }
          const errorDescription = searchParams.get("error_description");
          setError(`Authentication failed: ${errorDescription || errorParam}`);
          return;
        }

        // Check for JWT token (from backend redirect)
        const token = searchParams.get("token");
        setStep("🔍 You are authenticated...");
        if (token) {
          localStorage.setItem("authToken", token);
          const decoded = decodeToken(token);
          if (decoded) {
            const userRole = decoded.groups?.includes(
              config.admin_ad_group
            )
              ? "admin"
              : "user";
            setUser({
              userId: decoded.sub,
              userName: decoded.userinfo.name,
              userRole,
            });
          }
          const redirectTo = sessionStorage.getItem("redirectAfterLogin") || "/";
          sessionStorage.removeItem("redirectAfterLogin");
          window.location.href = redirectTo;
          return;
        }

        navigate("/login");
      } catch (err) {
        console.error("Callback processing error:", err);
        setError("An error occurred during authentication");
      }
    };

    processCallback();
  }, [
    searchParams,
    setUser,
    navigate,
    config.admin_ad_group
  ]);

  // Show error state
  if (error) {
    return (
      <div style={{ textAlign: "center", marginTop: "25%" }}>
        <h2>Authentication Error</h2>
        <p style={{ color: "red" }}>{error}</p>
        <button onClick={() => navigate("/login")}>Try Again</button>
      </div>
    );
  }

  // Show loading state
  return (
    <div
      style={{
        textAlign: "center",
        marginTop: "20%",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ marginBottom: "30px" }}>
        <div
          style={{
            display: "inline-block",
            width: "60px",
            height: "60px",
            border: "4px solid #f3f3f3",
            borderTop: "4px solid #3498db",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            marginBottom: "20px",
          }}
        ></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      <h2 style={{ color: "#2c3e50", marginBottom: "20px" }}>
        Authentication in Progress
      </h2>

      <p
        style={{
          fontSize: "18px",
          color: "#34495e",
          minHeight: "50px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {step}
      </p>

      <div style={{ marginTop: "30px", fontSize: "14px", color: "#7f8c8d" }}>
        <p>Please wait while we complete your authentication...</p>
        <p>This process may take a few moments.</p>
      </div>
    </div>
  );
}
