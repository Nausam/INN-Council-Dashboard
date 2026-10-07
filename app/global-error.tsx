"use client";

/**
 * Last-resort screen for errors the rest of the app can't handle, so the
 * installed Employee Profile app never gets stuck on a blank error page.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", padding: "24px", background: "#faf9fd", color: "#17191d", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800 }}>Something went wrong</h1>
          <p style={{ margin: "10px 0 22px", color: "#676873", fontSize: ".9rem", lineHeight: 1.5 }}>
            Reload to try again. If it keeps happening, send a screenshot of this screen.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ border: 0, borderRadius: 999, padding: "13px 26px", background: "#17191d", color: "#fff", fontSize: ".9rem", fontWeight: 800 }}
          >
            Reload
          </button>
          <p style={{ marginTop: 22, color: "#a3a1ab", fontSize: ".7rem", wordBreak: "break-word" }}>
            {error.message || "Unknown error"}
            {error.digest ? ` · ${error.digest}` : ""}
          </p>
        </div>
      </body>
    </html>
  );
}
