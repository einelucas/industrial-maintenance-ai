"use client";

// Último nível de captura de erro — só dispara se o próprio RootLayout
// falhar. Precisa renderizar <html>/<body> próprios (exigência do Next.js)
// e evita depender de globals.css, já que o problema pode estar ali.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f7f9fb",
          color: "#1f2430",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Erro crítico da aplicação</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
            {error.message || "Ocorreu um erro inesperado e a aplicação não pôde continuar."}
          </p>
          <button
            onClick={reset}
            style={{
              background: "#1c4e80",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
