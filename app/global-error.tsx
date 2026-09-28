"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0f1420",
          color: "#e8eaf0",
          padding: "24px",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "420px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
            Algo salió mal
          </h1>
          <p style={{ fontSize: "14px", opacity: 0.7, marginBottom: "20px" }}>
            {error.message || "Ocurrió un error inesperado en la aplicación."}
          </p>
          <button
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: "10px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              background: "#3b82f6",
              color: "#fff",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
