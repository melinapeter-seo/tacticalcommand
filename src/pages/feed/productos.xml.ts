import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { SITE, productos } from '../../lib/data';
import { img } from '../../lib/img';

// Feed para Google Merchant Center (listados gratuitos): un ítem por color, agrupado por item_group_id.
const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cap = (s: string) => s.toLowerCase().replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase());

export const GET: APIRoute = async () => {
  const items: string[] = [];
  for (const p of productos) {
    for (const c of p.colores) {
      const fotos = await Promise.all(c.fotos.slice(0, 10).map(async (f) => { const m = await img(f); return m ? SITE + (await getImage({ src: m, width: Math.min(1200, m.width), format: 'webp' })).src : null; }));
      const imgs = fotos.filter(Boolean) as string[];
      if (!imgs.length) continue; // Merchant exige imagen
      const multi = p.colores.length > 1;
      const talles = c.talles.map((t) => t.talle);
      items.push(`<item>
<g:id>${x(c.sku)}</g:id>
<g:item_group_id>${x(p.sku)}</g:item_group_id>
<g:title>${x(multi ? `${p.nombre} ${cap(c.nombre)}` : p.nombre)}</g:title>
<g:description>${x(p.descripcion)}</g:description>
<g:link>${SITE}/productos/${p.slug}/${multi ? '?color=' + encodeURIComponent(c.nombre) : ''}</g:link>
<g:image_link>${imgs[0]}</g:image_link>
${imgs.slice(1).map((u) => `<g:additional_image_link>${u}</g:additional_image_link>`).join('\n')}
<g:availability>in_stock</g:availability>
<g:price>${p.precio_minorista} ARS</g:price>
<g:condition>new</g:condition>
<g:brand>Tactical Command</g:brand>
<g:identifier_exists>no</g:identifier_exists>
<g:color>${x(cap(c.nombre))}</g:color>
${talles.length ? `<g:size>${x(talles.join('/'))}</g:size>` : ''}
<g:product_type>${x(cap(p.categoria) + ' > ' + cap(p.subcategoria))}</g:product_type>
</item>`);
    }
  }
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Tactical Command</title>
<link>${SITE}/</link>
<description>Indumentaria, equipos tácticos, calzado y accesorios.</description>
${items.join('\n')}
</channel>
</rss>
`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
