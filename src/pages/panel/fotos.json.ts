import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { productos, RESENAS } from '../../lib/data';
import { img } from '../../lib/img';

// Miniaturas de las fotos que están en el repo, para que el panel las muestre (las nuevas viven en Drive).
export const GET: APIRoute = async () => {
  const nombres = new Set([...productos.flatMap((p) => p.colores.flatMap((c) => c.fotos)), ...RESENAS.map((r) => r.foto)]);
  const fotos: Record<string, string> = {};
  for (const f of nombres) {
    const m = await img(f);
    if (m) fotos[f] = (await getImage({ src: m, width: 320, format: 'webp' })).src;
  }
  return new Response(JSON.stringify(fotos), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
