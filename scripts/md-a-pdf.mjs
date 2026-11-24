// Convierte un Markdown sencillo (títulos, párrafos, listas, casillas, citas, negrita, cursiva y código)
// en un PDF A4 con @react-pdf/renderer, el mismo que usa el proyecto para las facturas. Sirve para los
// documentos que se entregan al cliente en PDF (por ejemplo, `docs/guia-de-uso.md`).
//
// Uso, desde la raíz del proyecto (PowerShell o bash):
//   node scripts/md-a-pdf.mjs docs/guia-de-uso.md docs/guia-de-uso.pdf "El Maestro — Guía de uso"
//
// Usa la letra Segoe UI de Windows (la estándar de PDF no tiene algunos signos, como «→»).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const [input, output, footerText] = process.argv.slice(2);
const require = createRequire(pathToFileURL(`${process.cwd()}/package.json`));
const React = require("react");
globalThis.React = React;
const pdf = await import(pathToFileURL(require.resolve("@react-pdf/renderer")).href);
const { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } = pdf;
const h = React.createElement;

const FONTS = `${process.env.WINDIR ?? "C:/Windows"}/Fonts`.split("\\").join("/");
Font.register({
  family: "Segoe",
  fonts: [
    { src: `${FONTS}/segoeui.ttf` },
    { src: `${FONTS}/segoeuib.ttf`, fontWeight: "bold" },
    { src: `${FONTS}/segoeuii.ttf`, fontStyle: "italic" },
    { src: `${FONTS}/segoeuiz.ttf`, fontWeight: "bold", fontStyle: "italic" },
  ],
});
Font.register({ family: "Mono", src: `${FONTS}/consola.ttf` });
Font.registerHyphenationCallback((word) => [word]);

const INK = "#1f2328";
const MUTED = "#57606a";
const ACCENT = "#0b5cad";
const styles = StyleSheet.create({
  page: { fontFamily: "Segoe", fontSize: 10.5, color: INK, paddingTop: 48, paddingBottom: 56, paddingHorizontal: 54, lineHeight: 1.45 },
  h1: { fontSize: 22, fontWeight: "bold", color: ACCENT, lineHeight: 1.2, marginBottom: 12 },
  h2: { fontSize: 14.5, fontWeight: "bold", color: ACCENT, marginTop: 16, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: "#d0d7de" },
  h3: { fontSize: 11.5, fontWeight: "bold", marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 6 },
  quote: { marginBottom: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: "#d0d7de", color: MUTED },
  item: { flexDirection: "row", marginBottom: 3 },
  bullet: { width: 18 },
  itemBody: { flex: 1 },
  box: { width: 9, height: 9, borderWidth: 1, borderColor: INK, marginTop: 3, marginRight: 5 },
  code: { fontFamily: "Mono", fontSize: 9.5 },
  footer: { position: "absolute", top: 806, left: 54, right: 54, fontSize: 8.5, color: MUTED, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: "#d0d7de", paddingTop: 5 },
});

/** Negrita, cursiva y código en línea. */
function inline(text) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(h(Text, { key: i++, style: { fontWeight: "bold" } }, t.slice(2, -2)));
    else if (t.startsWith("`")) parts.push(h(Text, { key: i++, style: styles.code }, t.slice(1, -1)));
    else parts.push(h(Text, { key: i++, style: { fontStyle: "italic" } }, t.slice(1, -1)));
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const blocks = [];
let paragraph = [];
const flush = () => {
  if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join(" ") });
  paragraph = [];
};
for (const raw of readFileSync(input, "utf8").replace(/\r\n/g, "\n").split("\n")) {
  const line = raw.trimEnd();
  if (!line.trim()) { flush(); continue; }
  if (line === "---") { flush(); continue; }
  let m;
  if ((m = /^(#{1,3}) (.*)$/.exec(line))) { flush(); blocks.push({ kind: `h${m[1].length}`, text: m[2] }); continue; }
  if ((m = /^- \[( |x)\] (.*)$/.exec(line))) { flush(); blocks.push({ kind: "check", done: m[1] === "x", text: m[2] }); continue; }
  if ((m = /^- (.*)$/.exec(line))) { flush(); blocks.push({ kind: "li", marker: "•", text: m[1] }); continue; }
  if ((m = /^(\d+)\. (.*)$/.exec(line))) { flush(); blocks.push({ kind: "li", marker: `${m[1]}.`, text: m[2] }); continue; }
  if ((m = /^> (.*)$/.exec(line))) { flush(); blocks.push({ kind: "quote", text: m[1] }); continue; }
  paragraph.push(line.trim());
}
flush();

const children = blocks.map((b, i) => {
  switch (b.kind) {
    case "h1": return h(Text, { key: i, style: styles.h1 }, inline(b.text));
    case "h2": return h(Text, { key: i, style: styles.h2, minPresenceAhead: 60 }, inline(b.text));
    case "h3": return h(Text, { key: i, style: styles.h3, minPresenceAhead: 40 }, inline(b.text));
    case "quote": return h(Text, { key: i, style: styles.quote }, inline(b.text));
    case "li":
      return h(View, { key: i, style: styles.item, wrap: false }, h(Text, { style: styles.bullet }, b.marker), h(Text, { style: styles.itemBody }, inline(b.text)));
    case "check":
      return h(View, { key: i, style: styles.item, wrap: false }, h(View, { style: [styles.box, b.done ? { backgroundColor: INK } : {}] }), h(Text, { style: styles.itemBody }, inline(b.text)));
    default: return h(Text, { key: i, style: styles.p }, inline(b.text));
  }
});

const title = blocks.find((b) => b.kind === "h1")?.text ?? "Documento";
const doc = h(
  Document,
  { title, author: "El Maestro", language: "es-AR" },
  h(
    Page,
    { size: "A4", style: styles.page },
    // El pie va primero: así react-pdf lo repite abajo en todas las páginas.
    h(View, { style: styles.footer, fixed: true }, h(Text, null, footerText ?? title), h(Text, { render: ({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}` })),
    ...children,
  ),
);
writeFileSync(output, await renderToBuffer(doc));
console.log("ok", output);
