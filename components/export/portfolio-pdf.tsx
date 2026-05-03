import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2",
      fontWeight: 700,
    },
  ],
});

const palette = {
  bg: "#ffffff",
  surface: "#f9fafb",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  accent: "#16a34a",
  accentMuted: "#bbf7d0",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    backgroundColor: palette.bg,
    padding: 40,
    fontSize: 10,
    color: palette.text,
  },
  // Header
  header: {
    marginBottom: 24,
    borderBottom: `1px solid ${palette.border}`,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: palette.text,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 10,
    color: palette.muted,
  },
  // KPI grid
  kpiGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
    border: `1px solid ${palette.border}`,
    borderRadius: 6,
    padding: 12,
    backgroundColor: palette.surface,
  },
  kpiLabel: {
    fontSize: 8,
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: 700,
    color: palette.text,
  },
  // Section label
  sectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  // Table
  table: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: palette.surface,
    borderBottom: `1px solid ${palette.border}`,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 700,
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `1px solid ${palette.border}`,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },
  cell: {
    fontSize: 9,
    color: palette.text,
  },
  cellMono: {
    fontSize: 9,
    color: palette.text,
  },
  // Columns widths
  colTicker: { width: "12%" },
  colName: { width: "28%" },
  colQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "18%", textAlign: "right" },
  colValue: { width: "20%", textAlign: "right" },
  colAlloc: { width: "12%", textAlign: "right" },
  // Allocation badge
  allocBadge: {
    alignSelf: "center",
    backgroundColor: palette.accentMuted,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  allocBadgeText: {
    fontSize: 8,
    color: palette.accent,
    fontWeight: 700,
  },
  // Sector section
  sectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottom: `1px solid ${palette.border}`,
  },
  sectorName: {
    fontSize: 9,
    color: palette.text,
  },
  sectorPct: {
    fontSize: 9,
    color: palette.muted,
    fontWeight: 700,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: `1px solid ${palette.border}`,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: palette.muted,
  },
});

export type PDFPosition = {
  ticker: string;
  instrumentName: string | null;
  quantity: number;
  price: number;
  positionValue: number;
  allocationPct: number;
};

export type PDFSector = {
  sector: string;
  value: number;
  pct: number;
};

export type PortfolioPDFProps = {
  snapshotDate: string;
  totalArs: string;
  totalUsd: string | null;
  ccl: string | null;
  positions: PDFPosition[];
  sectors: PDFSector[];
  generatedAt: string;
};

function formatARSPDF(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PortfolioPDF({
  snapshotDate,
  totalArs,
  totalUsd,
  ccl,
  positions,
  sectors,
  generatedAt,
}: PortfolioPDFProps) {
  return (
    <Document
      title={`Portfolio Jubilación — ${snapshotDate}`}
      author="Portfolio Jubilación"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Portfolio de Jubilación</Text>
          <Text style={styles.headerSub}>
            Snapshot del {snapshotDate} · Cocos Capital
          </Text>
        </View>

        {/* KPIs */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Valor total ARS</Text>
            <Text style={styles.kpiValue}>{totalArs}</Text>
          </View>
          {totalUsd && (
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Equivalente USD</Text>
              <Text style={styles.kpiValue}>{totalUsd}</Text>
            </View>
          )}
          {ccl && (
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>CCL</Text>
              <Text style={styles.kpiValue}>{ccl}</Text>
            </View>
          )}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Posiciones</Text>
            <Text style={styles.kpiValue}>{positions.length}</Text>
          </View>
        </View>

        {/* Holdings table */}
        <Text style={styles.sectionLabel}>Holdings</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colTicker]}>Ticker</Text>
            <Text style={[styles.tableHeaderCell, styles.colName]}>Instrumento</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Cant.</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Precio</Text>
            <Text style={[styles.tableHeaderCell, styles.colValue]}>Valor</Text>
            <Text style={[styles.tableHeaderCell, styles.colAlloc]}>%</Text>
          </View>
          {positions.map((p, i) => (
            <View
              key={p.ticker}
              style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.cellMono, styles.colTicker, { fontWeight: 700 }]}>
                {p.ticker}
              </Text>
              <Text style={[styles.cell, styles.colName]}>
                {(p.instrumentName ?? "—").length > 35
                  ? (p.instrumentName ?? "—").slice(0, 35) + "…"
                  : (p.instrumentName ?? "—")}
              </Text>
              <Text style={[styles.cellMono, styles.colQty]}>
                {p.quantity.toLocaleString("es-AR")}
              </Text>
              <Text style={[styles.cellMono, styles.colPrice]}>
                {formatARSPDF(p.price)}
              </Text>
              <Text style={[styles.cellMono, styles.colValue]}>
                {formatARSPDF(p.positionValue)}
              </Text>
              <View style={[styles.colAlloc, { alignItems: "flex-end" }]}>
                <View style={styles.allocBadge}>
                  <Text style={styles.allocBadgeText}>
                    {p.allocationPct.toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Sector concentration */}
        {sectors.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 4 }]}>
              Concentración por Sector
            </Text>
            <View style={{ marginBottom: 24 }}>
              {sectors.slice(0, 10).map((s) => (
                <View key={s.sector} style={styles.sectorRow}>
                  <Text style={styles.sectorName}>{s.sector}</Text>
                  <Text style={styles.sectorPct}>{s.pct.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Portfolio Jubilación</Text>
          <Text style={styles.footerText}>Generado el {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
