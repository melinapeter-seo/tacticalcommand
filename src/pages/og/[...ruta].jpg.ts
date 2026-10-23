// Imágenes Open Graph 1200×630 generadas en el build: foto del producto/guía/categoría + escudo.
import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import path from 'node:path';
import { productos, categorias, guias } from '../../lib/data';

const ASSETS = path.resolve('src/assets/tc');

export const getStaticPaths: GetStaticPaths = () => [
  { params: { ruta: 'default' }, props: { foto: 'hero-poster.webp' } },
  ...productos.map((p) => ({ params: { ruta: `productos/${p.slug}` }, props: { foto: p.colores[0].fotos[0] || null } })),
  ...categorias.map((c) => ({ params: { ruta: `categorias/${c.slug}` }, props: { foto: c.imagen } })),
  ...guias.map((g) => ({ params: { ruta: `guias/${g.slug}` }, props: { foto: g.imagen } })),
];

export const GET: APIRoute = async ({ props }) => {
  const W = 1200, H = 630;
  const layers: sharp.OverlayOptions[] = [];
  const foto = props.foto as string | null;
  const wide = foto === 'hero-poster.webp' || categorias.some((c) => c.imagen === foto);
  if (foto) {
    const buf = await sharp(path.join(ASSETS, foto)).resize(wide ? W : H, H, { fit: 'cover' }).toBuffer();
    layers.push({ input: buf, left: 0, top: 0 });
  }
  if (wide) {
    layers.push({ input: Buffer.from(`<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#1A1D1B" stop-opacity=".1"/><stop offset=".55" stop-color="#1A1D1B" stop-opacity=".55"/><stop offset="1" stop-color="#1A1D1B" stop-opacity=".92"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`), left: 0, top: 0 });
  }
  // Escudo circular con halo dorado, centrado en el lado derecho.
  const S = 300;
  const logo = await sharp(path.join(ASSETS, 'logo-tc.webp')).resize(S, S).composite([{ input: Buffer.from(`<svg width="${S}" height="${S}"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="#fff"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
  const cx = wide ? W - 290 : H + (W - H) / 2;
  layers.push({ input: Buffer.from(`<svg width="${W}" height="${H}"><circle cx="${cx}" cy="${H / 2}" r="${S / 2 + 10}" fill="none" stroke="#E3B23C" stroke-opacity=".55" stroke-width="2"/><rect x="0" y="${H - 6}" width="${W}" height="6" fill="#E3B23C"/></svg>`), left: 0, top: 0 });
  layers.push({ input: logo, left: Math.round(cx - S / 2), top: Math.round(H / 2 - S / 2) });
  const out = await sharp({ create: { width: W, height: H, channels: 3, background: '#1A1D1B' } }).composite(layers).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(out, { headers: { 'Content-Type': 'image/jpeg' } });
};
