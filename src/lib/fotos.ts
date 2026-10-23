// Variantes optimizadas de una foto para galerías que cambian en el navegador (color de la ficha, mayorista).
import { getImage } from 'astro:assets';
import { img } from './img';

export type FotoVista = { src: string; srcset: string; w: number; h: number; full: string; thumb: string };

export async function fotoVista(name: string): Promise<FotoVista | null> {
  const meta = await img(name);
  if (!meta) return null;
  const widths = [...new Set([400, 800, 1200].filter((w) => w < meta.width).concat(meta.width))];
  const main = await getImage({ src: meta, widths, format: 'webp' });
  const thumb = await getImage({ src: meta, width: Math.min(240, meta.width), format: 'webp' });
  const full = await getImage({ src: meta, width: Math.min(1600, meta.width), format: 'webp' });
  return { src: main.src, srcset: main.srcSet.attribute, w: meta.width, h: meta.height, full: full.src, thumb: thumb.src };
}

export const fotosVista = async (names: string[]) => (await Promise.all(names.map(fotoVista))).filter(Boolean) as FotoVista[];
