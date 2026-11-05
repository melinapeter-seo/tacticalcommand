// Filas de la planilla ↔ modelo del panel, y la lista de cambios entre borrador y publicado.
import type { Cliente, Color, Ficha, Foto, Pedido, Producto } from './datos';
import { cap, money } from './datos';

export type ProdRow = { slug: string; nombre: string; categoria: string; subcategoria: string; sku: string; descripcion: string; visible: boolean | string; precio: number | string; talles: string; talles_ninos: string; orden: number | string; actualizado: string };
export type VarRow = { slug: string; idx: number | string; nombre: string; sku: string; swatch: string; fotos: string; precio: number | string; precios_talle: string; agotados: string; agotado: boolean | string; talles: string };
export type FichaRow = { slug: string; contenido: string; pendiente: boolean | string; notas: string };
export type Config = Record<string, string | number | boolean>;
export type Todo = {
  productos: ProdRow[]; variantes: VarRow[]; fichas: FichaRow[]; config: Config;
  productos_draft: ProdRow[]; variantes_draft: VarRow[]; fichas_draft: FichaRow[]; config_draft: Config;
  versiones: Record<string, string[]>; pedidos: Pedido[]; clientes: Cliente[];
};

const ORDEN_TALLES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
export const ordenarTalles = (ts: string[]) => [...new Set(ts.filter(Boolean))].sort((a, b) => {
  const ia = ORDEN_TALLES.indexOf(a), ib = ORDEN_TALLES.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return parseFloat(a) - parseFloat(b) || a.localeCompare(b);
});
const csv = (s: unknown) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
export const bool = (v: unknown) => v === true || /^(true|verdadero|si|sí|1)$/i.test(String(v ?? '').trim());
const num = (v: unknown) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
export const json = <T>(v: unknown, def: T): T => { if (v && typeof v === 'object') return v as T; try { return v ? JSON.parse(String(v)) : def; } catch { return def; } };

/** URL de una foto: archivo del repo (miniatura del build) o ID de Drive (miniatura pública). */
export type FotosRepo = Record<string, string>;
export const urlFoto = (id: string, repo: FotosRepo) => repo[id] || (/^[\w-]{20,}$/.test(id) ? `https://lh3.googleusercontent.com/d/${id}=w400` : '');

const fichaVacia = (): Omit<Ficha, 'descripcion'> => ({ descripcion_larga: [], caracteristicas: [], especificaciones: [], faq: [] });

export function aProductos(prods: ProdRow[], vars: VarRow[], fichas: FichaRow[], repo: FotosRepo): Producto[] {
  return prods.map((r) => {
    const f = fichas.find((x) => x.slug === r.slug);
    const c = json(f?.contenido, fichaVacia());
    const tallesProd = ordenarTalles(csv(r.talles));
    const ninos = ordenarTalles(csv(r.talles_ninos));
    const colores: Color[] = vars.filter((v) => v.slug === r.slug).sort((a, b) => (num(a.idx) ?? 0) - (num(b.idx) ?? 0)).map((v) => {
      const propios = csv(v.talles);
      return {
        nombre: String(v.nombre), sku: String(v.sku || ''), muestra: String(v.swatch || '#2F3530'),
        fotos: String(v.fotos || '').split('|').map((x) => x.trim()).filter(Boolean).map((id): Foto => ({ id, url: urlFoto(id, repo) })),
        talles: propios.length ? ordenarTalles(propios) : tallesProd, ninos,
        precio: num(v.precio), precios_talle: json(v.precios_talle, {} as Record<string, number>),
        agotado: bool(v.agotado), agotados: csv(v.agotados),
      };
    });
    return {
      slug: r.slug, nombre: String(r.nombre), categoria: String(r.categoria), subcategoria: String(r.subcategoria || ''), sku: String(r.sku || ''),
      visible: bool(r.visible), precio: num(r.precio) ?? 0, orden: num(r.orden) ?? 9999, actualizado: String(r.actualizado || ''),
      pendiente: bool(f?.pendiente), notas: String(f?.notas || ''),
      ficha: {
        descripcion: String(r.descripcion || ''), descripcion_larga: c.descripcion_larga || [], caracteristicas: c.caracteristicas || [],
        especificaciones: c.especificaciones || [], faq: c.faq || [],
      },
      colores,
    };
  });
}

/** Producto del panel → filas para `saveProduct`. */
export function aFilas(p: Producto) {
  const tallesProd = ordenarTalles(p.colores.flatMap((c) => c.talles));
  const ninos = ordenarTalles(p.colores.flatMap((c) => c.ninos));
  const limpio = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  return {
    producto: {
      slug: p.slug, nombre: p.nombre.trim(), categoria: p.categoria, subcategoria: p.subcategoria.trim().toUpperCase(), sku: p.sku.trim(),
      descripcion: p.ficha.descripcion.trim(), visible: p.visible, precio: p.precio, talles: tallesProd.join(','), talles_ninos: ninos.join(','),
      orden: p.orden, actualizado: p.actualizado,
    } as ProdRow,
    variantes: p.colores.map((c, idx): VarRow => ({
      slug: p.slug, idx, nombre: c.nombre.trim().toUpperCase(), sku: c.sku.trim(), swatch: c.muestra, fotos: c.fotos.map((f) => f.id).join('|'),
      precio: c.precio ?? '', precios_talle: Object.keys(c.precios_talle).length ? JSON.stringify(c.precios_talle) : '',
      agotados: c.agotados.filter((t) => c.talles.includes(t) || c.ninos.includes(t)).join(','), agotado: c.agotado, talles: c.talles.join(',') === tallesProd.join(',') ? '' : c.talles.join(','),
    })),
    ficha: {
      contenido: {
        descripcion_larga: limpio(p.ficha.descripcion_larga), caracteristicas: limpio(p.ficha.caracteristicas),
        especificaciones: p.ficha.especificaciones.filter((s) => s.k.trim() && s.v.trim()), faq: p.ficha.faq.filter((f) => f.q.trim() && f.a.trim()),
      },
      pendiente: p.pendiente, notas: p.notas,
    },
  };
}

export const slugDe = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Lista legible de lo que cambió entre lo publicado y el borrador (para «Revisar y publicar»). */
export function cambios(pub: Producto[], bor: Producto[], cfgPub: Config, cfgBor: Config) {
  const out: { t: string; w: string[] }[] = [];
  for (const d of bor) {
    const p = pub.find((x) => x.slug === d.slug);
    if (!p) { out.push({ t: d.nombre || 'Producto nuevo', w: [d.visible ? 'Producto nuevo, visible en la web' : 'Producto nuevo (oculto)'] }); continue; }
    const w: string[] = [];
    if (p.nombre !== d.nombre) w.push(`Nombre: ${p.nombre} → ${d.nombre}`);
    if (p.precio !== d.precio) w.push(`Precio: ${money(p.precio)} → ${money(d.precio)}`);
    if (p.visible !== d.visible) w.push(d.visible ? 'Ahora visible en la web' : 'Oculto en la web');
    if (p.categoria !== d.categoria || p.subcategoria !== d.subcategoria) w.push(`Categoría: ${cap(d.categoria)} / ${cap(d.subcategoria)}`);
    if (p.ficha.descripcion !== d.ficha.descripcion) w.push('Descripción corta');
    for (const k of ['descripcion_larga', 'caracteristicas', 'especificaciones', 'faq'] as const) {
      if (JSON.stringify(p.ficha[k]) !== JSON.stringify(d.ficha[k])) w.push({ descripcion_larga: 'Descripción larga', caracteristicas: 'Características', especificaciones: 'Especificaciones', faq: 'Preguntas frecuentes' }[k]);
    }
    const nombresP = p.colores.map((c) => c.nombre), nombresD = d.colores.map((c) => c.nombre);
    for (const n of nombresD) if (!nombresP.includes(n)) w.push(`Color nuevo: ${cap(n)}`);
    for (const n of nombresP) if (!nombresD.includes(n)) w.push(`Color quitado: ${cap(n)}`);
    for (const c of d.colores) {
      const o = p.colores.find((x) => x.nombre === c.nombre);
      if (!o) continue;
      if ((o.precio ?? null) !== (c.precio ?? null)) w.push(`${cap(c.nombre)}: ${c.precio == null ? 'usa el precio del producto' : 'precio ' + money(c.precio)}`);
      if (JSON.stringify(o.precios_talle) !== JSON.stringify(c.precios_talle)) w.push(`${cap(c.nombre)}: precios por talle`);
      if (o.fotos.map((f) => f.id).join() !== c.fotos.map((f) => f.id).join()) w.push(`${cap(c.nombre)}: fotos`);
      if (o.talles.join() !== c.talles.join() || o.ninos.join() !== c.ninos.join()) w.push(`${cap(c.nombre)}: talles`);
      if (o.agotado !== c.agotado) w.push(`${cap(c.nombre)}: ${c.agotado ? 'sin stock' : 'vuelve a tener stock'}`);
      else if (!c.agotado && o.agotados.slice().sort().join() !== c.agotados.slice().sort().join()) w.push(`${cap(c.nombre)}: ${c.agotados.length ? 'sin stock en ' + c.agotados.join(', ') : 'todos los talles con stock'}`);
    }
    if (w.length) out.push({ t: d.nombre, w });
  }
  for (const p of pub) if (!bor.some((x) => x.slug === p.slug)) out.push({ t: p.nombre, w: ['Producto eliminado: deja de verse en la web'] });
  const cw: string[] = [];
  const dif = (k: string) => String(cfgPub[k] ?? '') !== String(cfgBor[k] ?? '');
  if (dif('destacados')) cw.push('Destacados de la home');
  if (dif('aviso_activo') || dif('aviso_texto')) cw.push(bool(cfgBor.aviso_activo) && cfgBor.aviso_texto ? `Aviso en la web: «${cfgBor.aviso_texto}»` : 'Aviso en la web: apagado');
  if (dif('resenas')) cw.push('Fotos de clientes');
  if (dif('ws_minimo') || dif('ws_texto')) cw.push('Condiciones mayoristas');
  if (dif('envio_rafaela')) cw.push(`Envío dentro de Rafaela: ${money(Number(cfgBor.envio_rafaela))}`);
  if (cw.length) out.push({ t: 'Ajustes de la web', w: cw });
  return out;
}
