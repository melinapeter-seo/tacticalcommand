import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { SITE, productos, precioDe } from '../../lib/data';
import { img } from '../../lib/img';

// Feed para Google Merchant Center (listados gratuitos): un ítem por color, agrupado por item_group_id.
// Si un color tiene precios distintos por talle, un ítem por color y talle.
const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Peso aproximado del paquete (kg) para la tabla de envíos de Merchant Center: hasta 1 kg = envío chico; más = grande.
// Por subcategoría (palabra clave); si no coincide ninguna, un valor por categoría.
const PESOS: [RegExp, number][] = [[/PARCHE/, 0.1], [/SHEMAGH/, 0.3], [/SOMBRERO|GORRO/, 0.3], [/CINTUR|CINTO/, 0.4], [/GAFA/, 0.5], [/BAJO CHALECO/, 0.5],
  [/BANDOLERA/, 0.8], [/PANTAL/, 0.8], [/UNIFORME/, 1.5], [/CAMPERA/, 1.5], [/MOCHILA/, 2], [/BOLSO/, 2.5], [/BORCEGO|CALZADO/, 2.5]];
const PESO_CAT: Record<string, number> = { ACCESORIOS: 0.5, INDUMENTARIA: 1.2, CALZADO: 2.5, 'EQUIPOS TÁCTICOS': 2 };
const peso = (cat: string, sub: string) => PESOS.find(([re]) => re.test(sub))?.[1] ?? PESO_CAT[cat] ?? 1.5;
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
      const porTalle = new Set(talles.map((t) => precioDe(p, c, t))).size > 1;
      const agT = (t: string) => !!c.agotado || c.talles.some((x) => x.talle === t && x.estado === 'agotado');
      const variantes = porTalle ? talles.map((t) => ({ id: `${c.sku}-${t}`, talles: [t], precio: precioDe(p, c, t), ag: agT(t) })) : [{ id: c.sku, talles, precio: precioDe(p, c, talles[0]), ag: !!c.agotado || (talles.length > 0 && talles.every(agT)) }];
      for (const v of variantes) items.push(`<item>
<g:id>${x(v.id)}</g:id>
<g:item_group_id>${x(p.sku)}</g:item_group_id>
<g:title>${x(multi ? `${p.nombre} ${cap(c.nombre)}` : p.nombre)}</g:title>
<g:description>${x(p.descripcion)}</g:description>
<g:link>${SITE}/productos/${p.slug}/${multi ? '?color=' + encodeURIComponent(c.nombre) : ''}</g:link>
<g:image_link>${imgs[0]}</g:image_link>
${imgs.slice(1).map((u) => `<g:additional_image_link>${u}</g:additional_image_link>`).join('\n')}
<g:availability>${v.ag ? 'out_of_stock' : 'in_stock'}</g:availability>
<g:price>${v.precio} ARS</g:price>
<g:condition>new</g:condition>
<g:brand>Tactical Command</g:brand>
<g:identifier_exists>no</g:identifier_exists>
<g:color>${x(cap(c.nombre))}</g:color>
${v.talles.length ? `<g:size>${x(v.talles.join('/'))}</g:size>` : ''}
<g:product_type>${x(cap(p.categoria) + ' > ' + cap(p.subcategoria))}</g:product_type>
<g:shipping_weight>${peso(p.categoria, p.subcategoria)} kg</g:shipping_weight>
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
