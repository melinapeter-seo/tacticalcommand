import type { APIRoute } from 'astro';
import meta from '../../data/guias-meta.json';
import { SITE, guias } from '../../lib/data';

const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fechas = meta.guias as Record<string, { publicado: string; actualizado: string }>;

export const GET: APIRoute = () => new Response(
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Guías de Tactical Command</title>
<link>${SITE}/guias/</link>
<description>Guías sobre materiales y equipamiento táctico.</description>
<language>es-AR</language>
<atom:link href="${SITE}/guias/rss.xml" rel="self" type="application/rss+xml"/>
${guias.map((g) => `<item>
<title>${x(g.titulo)}</title>
<link>${SITE}/guias/${g.slug}/</link>
<guid>${SITE}/guias/${g.slug}/</guid>
<pubDate>${new Date(fechas[g.slug].publicado + 'T12:00:00-03:00').toUTCString()}</pubDate>
<description>${x(g.respuesta)}</description>
</item>`).join('\n')}
</channel>
</rss>
`,
  { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
);
