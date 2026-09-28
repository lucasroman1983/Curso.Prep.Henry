#!/usr/bin/env node
/*
 * Genera dist/anonimizador-actos.html: la herramienta completa en un único
 * archivo, sin dependencias externas. Se abre con doble clic en Chrome o
 * Edge, sin instalar nada y sin conexión a internet.
 *
 *   node anonimizador/build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const leer = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

// Dentro de <script> no puede aparecer "</script" ni "<!--": en estas
// bibliotecas solo figuran dentro de cadenas, donde el escape no cambia nada.
function paraScript(codigo, nombre) {
  if (/\x1b/.test(codigo)) throw new Error(`${nombre} contiene un byte ESC`);
  return codigo.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
}

let html = leer('index.html');

const vendor = ['vendor/pdf.worker.min.js', 'vendor/pdf.min.js', 'vendor/mammoth.browser.min.js']
  .map((f) => `<script>/* ${f} — ver vendor/LICENCIAS.md */\n${paraScript(leer(f), f)}\n</script>`)
  .join('\n');

if (!html.includes('<!-- VENDOR -->')) throw new Error('Falta la marca <!-- VENDOR --> en index.html');
html = html.replace('<!-- VENDOR -->', () => vendor);

for (const f of ['anonimizador.js', 'exportar.js']) {
  const etiqueta = `<script src="${f}"></script>`;
  if (!html.includes(etiqueta)) throw new Error(`Falta ${etiqueta} en index.html`);
  html = html.replace(etiqueta, () => `<script>\n${paraScript(leer(f), f)}\n</script>`);
}

if (/<script[^>]+src=/.test(html)) throw new Error('Quedó un <script src> sin incluir');

fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
const destino = path.join(dir, 'dist', 'anonimizador-actos.html');
fs.writeFileSync(destino, html);
console.log(`${path.relative(process.cwd(), destino)} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
