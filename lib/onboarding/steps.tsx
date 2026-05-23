import type { Tour } from "nextstepjs";

export const PRIMER_USO_TOUR = "primerUso";

export const onboardingSteps: Tour[] = [
  {
    tour: PRIMER_USO_TOUR,
    steps: [
      {
        icon: "👋",
        title: "Bienvenido a Portfolio Jubilación",
        content: (
          <>
            Para usar la app necesitás <strong>dos archivos CSV distintos</strong> desde
            Cocos Capital: uno para el estado de tu cartera (snapshots) y otro para tus
            compras y ventas (transacciones). Este tour te muestra dónde descargar cada
            uno y dónde importarlos acá.
          </>
        ),
        side: "bottom",
        showControls: true,
        showSkip: true,
      },
      {
        icon: "📊",
        title: "Snapshots — estado del portfolio",
        content: (
          <>
            El CSV del snapshot se descarga desde <strong>Portfolio</strong> en Cocos (no
            desde Actividad). Acá importalo desde la sección{" "}
            <strong>Snapshots</strong> del menú lateral.
          </>
        ),
        selector: "#tour-nav-snapshots",
        side: "right",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 8,
      },
      {
        icon: "📖",
        title: "Guía completa con capturas",
        content: (
          <>
            En <strong>Guía Cocos</strong> encontrás los pasos detallados con screenshots
            de la app de Cocos Capital para descargar cada archivo correctamente.
          </>
        ),
        selector: "#tour-nav-guia",
        side: "right",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 8,
        nextRoute: "/guia",
      },
      {
        icon: "🥧",
        title: "Descargar portfolio en Cocos",
        content: (
          <>
            En Cocos: menú lateral → <strong>Portfolio</strong> →{" "}
            <strong>Descargar portfolio</strong> → elegí la fecha → descargá{" "}
            <strong>CSV</strong>. El archivo se llama{" "}
            <code className="text-xs">portfolio_report_AAAAMMDD.csv</code>.
          </>
        ),
        selector: "#tour-guide-snapshots",
        side: "top",
        showControls: true,
        showSkip: true,
        pointerPadding: 12,
        pointerRadius: 12,
        prevRoute: "/",
      },
      {
        icon: "↔️",
        title: "Transacciones — compras y ventas",
        content: (
          <>
            Las operaciones se descargan desde <strong>Actividad</strong> en Cocos (no
            desde Portfolio). Importá ese CSV desde la sección{" "}
            <strong>Transacciones</strong> del menú lateral.
          </>
        ),
        selector: "#tour-nav-transacciones",
        side: "right",
        showControls: true,
        showSkip: true,
        pointerPadding: 8,
        pointerRadius: 8,
        prevRoute: "/guia",
      },
      {
        icon: "📈",
        title: "Descargar movimientos en Cocos",
        content: (
          <>
            En Cocos: menú lateral → <strong>Actividad</strong> →{" "}
            <strong>Descargar movimientos</strong> → elegí año/mes → descargá{" "}
            <strong>CSV</strong>. El archivo se llama{" "}
            <code className="text-xs">movements_report_YYYY-MM-DD_YYYY-MM-DD.csv</code>.
            ¡Listo! Ya sabés de dónde sacar cada dato.
          </>
        ),
        selector: "#tour-guide-transacciones",
        side: "top",
        showControls: true,
        showSkip: true,
        pointerPadding: 12,
        pointerRadius: 12,
        prevRoute: "/guia",
      },
    ],
  },
];
