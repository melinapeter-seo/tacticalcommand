import type { ImageMetadata } from 'astro';

// Carga diferida: solo se emiten al build las imágenes que realmente se usan.
const files = import.meta.glob<ImageMetadata>('/src/assets/tc/*.{webp,png,jpg}', { import: 'default' });

const byName: Record<string, () => Promise<ImageMetadata>> = {};
for (const [path, load] of Object.entries(files)) byName[path.split('/').pop()!] = load;

/** ¿Existe la imagen en src/assets/tc? */
export const hasImg = (name: string | null | undefined) => !!name && !!(byName[name] || byName[decodeURIComponent(name)]);

/** Devuelve la imagen optimizable por nombre de archivo (ej. "cin-ng-1.webp"). */
export async function img(name: string | null | undefined): Promise<ImageMetadata | null> {
  if (!name) return null;
  const load = byName[name] || byName[decodeURIComponent(name)];
  return load ? load() : null;
}
