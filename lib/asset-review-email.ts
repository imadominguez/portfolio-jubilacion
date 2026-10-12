// Mail al admin con los pedidos de alta que necesitan su revisión (ADR-0026).
// Puro: solo tickers, nombres del CSV y motivos; nada de montos ni de usuarios.

export type ReviewItem = {
  ticker: string;
  instrumentName: string | null;
  status: "NEEDS_REVIEW" | "FAILED";
  // Controles que no pasaron, o el error si falló.
  reasons: string[];
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function buildAssetReviewEmail(
  items: ReviewItem[],
  appUrl: string
): { subject: string; text: string; html: string } | null {
  if (items.length === 0) return null;
  const subject =
    items.length === 1
      ? `Portfolio: ${items[0].ticker} espera tu revisión para darse de alta`
      : `Portfolio: ${items.length} activos esperan tu revisión`;
  const url = `${appUrl.replace(/\/$/, "")}/assets#pedidos`;

  const text: string[] = ["Activos nuevos que el sistema no pudo dar de alta solo:", ""];
  const html: string[] = [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#111;line-height:1.5">`,
    `<h2 style="font-size:18px;margin:0 0 12px">Activos nuevos para revisar</h2>`,
    `<p style="margin:0 0 16px">Aparecieron en el snapshot de un usuario y no están en el catálogo. El sistema no pudo confirmar todos sus datos:</p>`,
  ];
  for (const item of items) {
    const title = item.instrumentName ? `${item.ticker} (${item.instrumentName})` : item.ticker;
    const label = item.status === "FAILED" ? "Falló la búsqueda" : "Para revisar";
    text.push(`${title} — ${label}`, ...item.reasons.map((r) => `  - ${r}`), "");
    html.push(
      `<div style="margin:0 0 12px;padding:12px;border:1px solid #e5e5e5;border-radius:8px">`,
      `<p style="margin:0;font-weight:600">${escapeHtml(title)} <span style="font-weight:400;color:#777">· ${label}</span></p>`,
      `<ul style="margin:6px 0 0;padding-left:18px;font-size:13px">${item.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`,
      `</div>`
    );
  }
  text.push(`Revisalos en ${url}`);
  html.push(`<p style="margin:16px 0 0"><a href="${escapeHtml(url)}">Revisar en Activos</a></p>`, `</div>`);
  return { subject, text: text.join("\n"), html: html.join("") };
}

export type RatioChangeItem = { ticker: string; oldRatio: number; newRatio: number };

const fmtRatio = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 4 });

// Aviso de cambios de ratio que BYMA publicó y el catálogo todavía no tiene
// (ADR-0027). El admin confirma la fecha del split en Activos.
export function buildRatioChangeEmail(
  items: RatioChangeItem[],
  listingVersionLabel: string,
  appUrl: string
): { subject: string; text: string; html: string } | null {
  if (items.length === 0) return null;
  const subject =
    items.length === 1
      ? `Portfolio: BYMA cambió el ratio de ${items[0].ticker}`
      : `Portfolio: BYMA cambió el ratio de ${items.length} CEDEARs`;
  const url = `${appUrl.replace(/\/$/, "")}/assets#cambios-de-ratio`;
  const lines = items.map((i) => `${i.ticker}: ${fmtRatio(i.oldRatio)} → ${fmtRatio(i.newRatio)}`);
  const intro = `El listado de BYMA del ${listingVersionLabel} trae ratios distintos de los del catálogo. Si es un split, confirmá desde qué día rige para ajustar las operaciones anteriores.`;
  return {
    subject,
    text: [intro, "", ...lines, "", `Revisalos en ${url}`].join("\n"),
    html: [
      `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#111;line-height:1.5">`,
      `<h2 style="font-size:18px;margin:0 0 12px">Cambios de ratio en el listado de BYMA</h2>`,
      `<p style="margin:0 0 12px">${escapeHtml(intro)}</p>`,
      `<ul style="margin:0;padding-left:18px">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`,
      `<p style="margin:16px 0 0"><a href="${escapeHtml(url)}">Revisar en Activos</a></p>`,
      `</div>`,
    ].join(""),
  };
}
