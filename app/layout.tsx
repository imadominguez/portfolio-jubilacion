import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

// Fuentes self-hosted (variables, subset latin, de Fontsource; licencias OFL en
// app/fonts/). next/font/google descarga de Google en cada build y falla de forma
// intermitente con Turbopack (vercel/next.js#99114).
const plusJakartaSans = localFont({
  src: "./fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  variable: "--font-plus-jakarta",
  weight: "200 800",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-wght-normal.woff2",
  variable: "--font-jetbrains-mono",
  weight: "100 800",
  display: "swap",
  // El fallback ajustado de next/font/local solo admite Arial o Times New Roman;
  // para una monoespaciada se usa el stack ui-monospace de globals.css.
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: { default: "Portfolio Jubilación", template: "%s | Portfolio Jubilación" },
  description: "Dashboard personal para seguimiento del portafolio de inversiones en CEDEARs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
