import { describe, expect, it } from "vitest";
import { buildAssetReviewEmail } from "./asset-review-email";

describe("buildAssetReviewEmail", () => {
  it("no arma mail sin pedidos", () => {
    expect(buildAssetReviewEmail([], "https://app.example")).toBeNull();
  });

  it("lista cada pedido con sus motivos y el link a Activos", () => {
    const mail = buildAssetReviewEmail(
      [
        { ticker: "EJM", instrumentName: "CEDEAR EJEMPLO <INC> (EJM)", status: "NEEDS_REVIEW", reasons: ["No figura en el listado de BYMA."] },
        { ticker: "OTR", instrumentName: null, status: "FAILED", reasons: ["Yahoo no respondió."] },
      ],
      "https://app.example/"
    )!;
    expect(mail.subject).toBe("Portfolio: 2 activos esperan tu revisión");
    expect(mail.text).toContain("EJM (CEDEAR EJEMPLO <INC> (EJM)) — Para revisar");
    expect(mail.text).toContain("OTR — Falló la búsqueda");
    expect(mail.text).toContain("https://app.example/assets#pedidos");
    // El nombre del CSV se escapa en el HTML.
    expect(mail.html).toContain("EJEMPLO &lt;INC&gt;");
    expect(mail.html).not.toContain("<INC>");
  });

  it("con un solo pedido nombra el ticker en el asunto", () => {
    const mail = buildAssetReviewEmail([{ ticker: "EJM", instrumentName: null, status: "NEEDS_REVIEW", reasons: [] }], "")!;
    expect(mail.subject).toBe("Portfolio: EJM espera tu revisión para darse de alta");
  });
});
