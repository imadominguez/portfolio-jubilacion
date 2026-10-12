// pdfjs-dist no publica tipos para el worker. Se importa solo por su efecto:
// registra el worker en globalThis para que pdf.js funcione en Node (ADR-0024).
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
