// Genera la imagen para compartir de cada guía (mismo estilo que la de la web: título, logo abajo y productos en
// mosaico). Uso: node design/og/guias.mjs  → escribe src/assets/og/guias/<slug>.jpg (requiere Playwright).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');

const RAIZ = path.resolve(import.meta.dirname, '../..');
const TC = path.join(RAIZ, 'src/assets/tc');
const guias = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src/data/guias.json'), 'utf8'));
const catalogo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src/data/catalog.json'), 'utf8'));
const SALIDA = path.join(RAIZ, 'src/assets/og/guias');
fs.mkdirSync(SALIDA, { recursive: true });

/** 4 fotos: productos de la guía, su portada y galería, y si faltan, otros colores de esos productos. */
function fotos(g) {
  const out = [];
  const sumar = (f) => { if (f && fs.existsSync(path.join(TC, f)) && !out.includes(f)) out.push(f); };
  const prods = [];
  for (const k of g.productos || []) for (const p of catalogo.productos) {
    const t = p.tarjetas.find((x) => x.clave === k);
    if (t) { sumar(t.imagen); prods.push(p); }
  }
  sumar(g.imagen);
  for (const p of prods) for (const c of p.colores) sumar(c.fotos[0]);
  (g.galeria || []).forEach(sumar);
  return out.slice(0, 4);
}

const url = (f) => 'file://' + path.join(TC, f);
const fuente = (f) => 'file://' + path.join(RAIZ, 'public/fonts', f);
const pagina = (g) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Gunplay'; src: url('${fuente('tc-gunplay.woff2')}') format('woff2'); }
@font-face { font-family: 'Plex'; src: url('${fuente('ibm-plex-mono-latin-400-normal.woff2')}') format('woff2'); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #0F110F; }
.c { position: relative; width: 1200px; height: 630px; overflow: hidden; }
.fondo { position: absolute; inset: 0; background: url('${url('op-01.webp')}') center/cover; filter: blur(6px) brightness(.32) saturate(.7); transform: scale(1.08); }
.izq { position: absolute; left: 66px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; }
.eti { font-family: 'Plex', monospace; color: #E3B23C; letter-spacing: .3em; font-size: 16px; margin-bottom: 18px; }
.tit { font-family: 'Gunplay', sans-serif; color: #F2F2EE; line-height: 1.04; letter-spacing: .01em; text-shadow: 0 4px 18px rgba(0,0,0,.6); max-height: 330px; }
.tit .g { color: #E3B23C; }
.pie { display: flex; align-items: center; gap: 22px; margin-top: 30px; }
.logo { width: 104px; height: 104px; border-radius: 50%; box-shadow: 0 0 0 3px rgba(227,178,60,.55), 0 10px 30px rgba(0,0,0,.6); }
.url { font-family: 'Plex', monospace; color: #C9CDC6; font-size: 15px; letter-spacing: .26em; line-height: 1.7; }
.mos { position: absolute; right: 52px; top: 52px; bottom: 59px; width: 470px; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px; }
.mos img { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; border: 1px solid rgba(227,178,60,.35); box-shadow: 0 10px 26px rgba(0,0,0,.55); }
.barra { position: absolute; left: 0; right: 0; bottom: 0; height: 7px; background: #E3B23C; }
</style></head><body><div class="c">
<div class="fondo"></div>
<div class="izq">
  <div class="eti">GUÍA · TACTICAL COMMAND</div>
  <div class="tit" id="tit">${titulo(g)}</div>
  <div class="pie"><img class="logo" src="${url('logo-tc.webp')}"><div class="url">TACTICAL COMMAND<br>TACTICALCOMMAND.COM.AR</div></div>
</div>
<div class="mos">${fotos(g).map((f) => `<img src="${url(f)}">`).join('')}</div>
<div class="barra"></div>
</div></body></html>`;

/** Título en mayúsculas; lo que va después de «:» (o la segunda mitad) en dorado. */
function titulo(g) {
  const t = g.titulo.toUpperCase();
  const i = t.indexOf(':');
  if (i > 0) return `${t.slice(0, i + 1)} <span class="g">${t.slice(i + 1).trim()}</span>`;
  const p = t.split(' '), m = Math.ceil(p.length / 2);
  return `${p.slice(0, m).join(' ')} <span class="g">${p.slice(m).join(' ')}</span>`;
}

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const g of guias) {
  // Desde un archivo (no setContent): así el navegador puede cargar las fotos y tipografías locales.
  const tmp = path.join(os.tmpdir(), `og-guia-${g.slug}.html`);
  fs.writeFileSync(tmp, pagina(g));
  await pg.goto('file://' + tmp, { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  // Tamaño de letra: el más grande (hasta 66 px) con el que el título entra en el espacio.
  await pg.evaluate(() => {
    const t = document.getElementById('tit');
    let s = 66;
    t.style.fontSize = s + 'px';
    while (s > 34 && (t.scrollHeight > 330 || t.scrollWidth > 560)) t.style.fontSize = --s + 'px';
  });
  const png = await pg.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(SALIDA, `${g.slug}.jpg`));
  console.log('·', g.slug, fotos(g).join(', '));
}
await b.close();
