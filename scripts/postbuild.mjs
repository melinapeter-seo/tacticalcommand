// Post-build: 1) borra de dist/_astro las imágenes que ninguna página referencia (Vite emite todos los
// originales del glob); 2) genera dist/sitemap-imagenes.xml con las fotos de fichas y guías.
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const SITE = 'https://tacticalcommand.com.ar';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(DIST);
const textos = files.filter((f) => /\.(html|css|js|mjs|xml|txt|json|webmanifest)$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

let borrados = 0, bytes = 0;
for (const f of files) {
  if (!f.startsWith(path.join(DIST, '_astro')) || !/\.(webp|png|jpe?g|avif)$/i.test(f)) continue;
  const name = path.basename(f);
  if (!textos.includes(name) && !textos.includes(encodeURI(name)) && !textos.includes(encodeURIComponent(name))) {
    bytes += fs.statSync(f).size; fs.unlinkSync(f); borrados++;
  }
}
console.log(`postbuild: ${borrados} imágenes sin uso eliminadas (${(bytes / 1048576).toFixed(1)} MB)`);

// Sitemap de imágenes a partir del JSON-LD de cada página.
const x = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const urls = [];
for (const f of files.filter((f) => f.endsWith('index.html') && /[/\\](productos|guias)[/\\]/.test(f))) {
  const html = fs.readFileSync(f, 'utf8');
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!m) continue;
  const g = JSON.parse(m[1])['@graph'] || [];
  const imgs = new Set();
  for (const n of g) {
    [].concat(n.image || []).forEach((u) => imgs.add(u));
    (n.hasVariant || []).forEach((v) => [].concat(v.image || []).forEach((u) => imgs.add(u)));
  }
  if (!imgs.size) continue;
  const loc = SITE + '/' + path.relative(DIST, path.dirname(f)).split(path.sep).join('/') + '/';
  urls.push(`<url><loc>${x(loc)}</loc>${[...imgs].slice(0, 1000).map((u) => `<image:image><image:loc>${x(u)}</image:loc></image:image>`).join('')}</url>`);
}
fs.writeFileSync(path.join(DIST, 'sitemap-imagenes.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`);
console.log(`postbuild: sitemap-imagenes.xml con ${urls.length} páginas`);
