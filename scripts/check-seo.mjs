// Chequeo de SEO sobre dist/ (corre en CI): falla si una página indexable no tiene title, description,
// canonical o un único H1, o si una ficha no tiene ProductGroup/Product, Offer y BreadcrumbList.
import fs from 'node:fs';
import path from 'node:path';

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const errores = [];
const pages = walk('dist').filter((f) => f.endsWith('.html'));

for (const f of pages) {
  const h = fs.readFileSync(f, 'utf8');
  const rel = '/' + path.relative('dist', f).replace(/index\.html$/, '').split(path.sep).join('/');
  const noindex = /<meta name="robots" content="noindex/.test(h);
  const err = (m) => errores.push(`${rel}: ${m}`);
  const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1];
  if (!title) err('sin <title>');
  if (!/<meta name="description" content="[^"]{50,}"/.test(h)) err('description ausente o muy corta');
  if (!/<html lang="es-AR"/.test(h)) err('falta lang="es-AR"');
  if (noindex) continue;
  if (!/<link rel="canonical" href="https:\/\/tacticalcommand\.com\.ar(\/[^"]*)?\/"/.test(h)) err('canonical ausente o sin barra final');
  const h1 = (h.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) err(`tiene ${h1} <h1>`);
  const ld = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ld) { err('sin JSON-LD'); continue; }
  let g;
  try { g = JSON.parse(ld[1])['@graph'] || []; } catch { err('JSON-LD inválido'); continue; }
  const types = g.flatMap((n) => [].concat(n['@type']));
  if (rel.startsWith('/productos/')) {
    if (!types.includes('ProductGroup')) err('ficha sin ProductGroup');
    const pg = g.find((n) => [].concat(n['@type']).includes('ProductGroup')) || {};
    if (!(pg.hasVariant || []).length || !(pg.hasVariant || []).every((v) => v['@type'] === 'Product' && v.offers && v.offers['@type'] === 'Offer' && v.offers.price)) err('variantes sin Product/Offer con precio');
    if (!types.includes('BreadcrumbList')) err('ficha sin BreadcrumbList');
    if (!/<data value="\d+"/.test(h)) err('precio visible sin <data>');
  }
  if (rel !== '/' && !types.includes('BreadcrumbList')) err('sin BreadcrumbList');
}

if (errores.length) { console.error(errores.join('\n')); console.error(`\n${errores.length} problema(s) de SEO`); process.exit(1); }
console.log(`check-seo: ${pages.length} páginas OK`);
