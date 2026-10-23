import catalogo from '../data/catalog.json';
import categoriasJson from '../data/categorias.json';
import guiasJson from '../data/guias.json';
import legalesJson from '../data/legales.json';
import sitioJson from '../data/sitio.json';

export type Talle = { talle: string; estado: string };
export type Color = { nombre: string; sku: string; muestra: string; fotos: string[]; talles: Talle[] };
export type Tarjeta = { clave: string; nombre: string; color: string | null; imagen: string | null; rota?: string[] };
export type Producto = (typeof catalogo.productos)[number] & { colores: Color[]; tarjetas: Tarjeta[] };
export type Categoria = (typeof categoriasJson)[number];
export type Guia = (typeof guiasJson)[number];

export const SITE = 'https://tacticalcommand.com.ar';
export const sitio = sitioJson;
export const productos = catalogo.productos as Producto[];
export const categorias = categoriasJson;
export const guias = guiasJson;
export const legales = legalesJson;

export const producto = (slug: string) => productos.find((p) => p.slug === slug);
export const categoriaDeProducto = (p: Producto) => categorias.find((c) => c.titulo === p.categoria)!;

export const money = (n: number) => '$ ' + n.toLocaleString('es-AR');

export const WA = (t: string) => `https://wa.me/${sitio.whatsapp}?text=${encodeURIComponent(t)}`;
export const WA_CONSULTA = WA('Hola Tactical Command! Quiero hacer una consulta.');

const TARJETAS: Record<string, { p: Producto; t: Tarjeta }> = {};
for (const p of productos) for (const t of p.tarjetas) TARJETAS[t.clave] = { p, t };

/** Datos de una tarjeta de listado (una por color). Nombre, precio y SKU salen del producto. */
export function tarjeta(clave: string) {
  const hit = TARJETAS[clave];
  if (!hit) return null;
  const { p, t } = hit;
  const col = p.colores.find((c) => c.nombre === t.color) || p.colores[0];
  const url = `/productos/${p.slug}/` + (t.color ? `?color=${encodeURIComponent(t.color)}` : '');
  return {
    clave, nombre: t.nombre, categoria: p.categoria, sku: t.color ? col.sku : p.sku, url, slug: p.slug,
    imagen: t.imagen || col.fotos[0] || null, rota: t.rota || null,
    precio: p.precio_minorista, placeholder: p.nombre.toUpperCase(),
  };
}
export type TarjetaVista = NonNullable<ReturnType<typeof tarjeta>>;

/** Tarjetas destacadas de la home (orden del prototipo). */
export const DESTACADOS = ['gtexng', 'mocam', 'altama', 'unimp', 'cintocy', 'mocb70c', 'pantr', 'gafas', 'shemagh', 'gtexod', 'unigt', 'moc45vm', 'sombrero', 'chalmlmc', 'bandng'];

/** "Completá el equipo": 2 tarjetas por cada otra categoría, priorizando las relacionadas (lógica del prototipo). */
export function relacionados(p: Producto) {
  let seed = 0;
  for (const ch of p.slug) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const out: string[] = [];
  for (const cat of categorias.filter((c) => c.titulo !== p.categoria)) {
    const its = cat.tarjetas.filter((k) => TARJETAS[k]);
    const rot = its.map((_, i) => its[(i + seed) % its.length]);
    const subDe = (k: string) => (Object.entries(cat.sub_mapa as Record<string, string[]>).find(([, v]) => v.includes(k)) || [''])[0];
    const cand = [...p.relacionados_tarjetas.filter((k) => its.includes(k)), ...rot];
    const pick: string[] = [], usados = new Set<string>(), subs = new Set<string>();
    for (const k of cand) {
      const sl = TARJETAS[k].p.slug;
      if (usados.has(sl) || sl === p.slug || subs.has(subDe(k))) continue;
      pick.push(k); usados.add(sl); subs.add(subDe(k));
      if (pick.length === 2) break;
    }
    for (const k of cand) {
      if (pick.length === 2) break;
      const sl = TARJETAS[k].p.slug;
      if (usados.has(sl) || sl === p.slug) continue;
      pick.push(k); usados.add(sl);
    }
    out.push(...pick);
  }
  return out;
}

export const NAV = [
  { t: 'INDUMENTARIA', url: '/indumentaria/' },
  { t: 'EQUIPOS TÁCTICOS', url: '/equipos-tacticos/' },
  { t: 'CALZADO', url: '/calzado/' },
  { t: 'ACCESORIOS', url: '/accesorios/' },
  { t: 'NOSOTROS', url: '/nosotros/' },
  { t: 'GUÍAS', url: '/guias/' },
  { t: 'TU PEDIDO', url: '/envios/' },
];

export const FOOTER = [
  { t: 'CATEGORÍAS', links: [{ t: 'Indumentaria', url: '/indumentaria/' }, { t: 'Equipos tácticos', url: '/equipos-tacticos/' }, { t: 'Calzado', url: '/calzado/' }, { t: 'Accesorios', url: '/accesorios/' }] },
  { t: 'AYUDA', links: [{ t: 'Tu pedido', url: '/envios/' }, { t: 'Preguntas frecuentes', url: '/envios/#faq' }, { t: 'Contacto', url: '/envios/#contacto' }] },
  { t: 'EXPLORÁ', links: [{ t: 'Nosotros', url: '/nosotros/' }, { t: 'Portal Mayorista', url: '/mayoristas/' }, { t: 'Guías', url: '/guias/' }] },
  {
    t: 'LEGAL', legal: true,
    links: legales.map((l) => ({ t: l.titulo, corto: ({ 'Política de envíos': 'Envíos', 'Política de cambios y devoluciones': 'Cambios y devoluciones', 'Política de privacidad': 'Privacidad', 'Política de cookies': 'Cookies' } as Record<string, string>)[l.titulo], url: `/legal/${l.slug}/` })),
  },
];

/** Convierte rutas hash del prototipo (#/blog/x/) en rutas reales (/guias/x/). */
export const ruta = (to: string) => to.replace(/^#/, '').replace(/^\/blog\//, '/guias/');

/** Índice del buscador (se embebe en la página). */
export function indiceBusqueda() {
  const seen = new Set<string>();
  const items = Object.keys(TARJETAS).map((k) => tarjeta(k)!).filter((t) => (seen.has(t.nombre) ? false : (seen.add(t.nombre), true)));
  return [
    ...items.map((t) => ({ k: t.categoria, t: t.nombre, u: t.url })),
    ...categorias.map((c) => ({ k: 'CATEGORÍA', t: c.titulo, u: `/${c.slug}/` })),
    { k: 'TÉRMINO TÉCNICO', t: 'Costuras selladas', u: '/productos/campera-gtex-outdoor/' },
    { k: 'TÉRMINO TÉCNICO', t: 'Sistema MOLLE', u: '/guias/que-es-el-sistema-molle/' },
    ...guias.map((g) => ({ k: 'GUÍA', t: g.titulo, u: `/guias/${g.slug}/` })),
    { k: 'MAYORISTAS', t: 'Portal mayorista', u: '/mayoristas/' },
  ];
}
