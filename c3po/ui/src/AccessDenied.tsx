import { useConfig } from "./contexts/ConfigContext";

const AccessDenied = () => {
  const { config } = useConfig()
  const SUPPORT_EMAIL = config.support_email || "Rahul.Chaturvedi@gilead.com";

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Segoe UI, Arial, sans-serif",
        color: "#2c3e50",
        background: "#fff",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          padding: "32px 48px",
          borderRadius: "16px",
          background: "#f8f9fa",
          boxShadow: "0 4px 24px rgba(44,62,80,0.08)",
          border: "1px solid #e0e0e0",
          textAlign: "center",
          minWidth: "320px",
          maxWidth: "90vw",
        }}
      >
        <h1
          style={{ fontSize: "2.5rem", marginBottom: "16px", color: "#e74c3c" }}
        >
          Access Denied
        </h1>
        <p style={{ fontSize: "1.2rem", marginBottom: "24px" }}>
          You do not have permission to view this page.
        </p>
        <p style={{ fontSize: "1rem", color: "#555" }}>
          If you believe this is a mistake, please contact{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            style={{ color: "#1976d2", textDecoration: "underline" }}
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <button
          style={{
            marginTop: "24px",
            padding: "10px 28px",
            borderRadius: "6px",
            border: "none",
            background: "#1976d2",
            color: "#fff",
            fontSize: "1rem",
            cursor: "pointer",
          }}
          onClick={() => (window.location.href = "/login")}
        >
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default AccessDenied;
