// Conversión entre el catálogo del repo (src/data/*.json) y las hojas de la planilla.
// - aFilas(): repo → filas de `productos` / `variantes` / `config` (semilla de la planilla).
// - combinar(): respuesta de la API (`catalog`) + contenido largo del repo → catálogo que usa la web.
// Columnas: design/HANDOFF.md › Google Sheets. `variantes.talles` es un agregado: talles propios del color
// (vacío = los del producto), necesario para la Campera Gore-Tex (Azul Noche llega hasta 3XL).

export const COLS = {
  productos: ['slug', 'nombre', 'categoria', 'subcategoria', 'sku', 'descripcion', 'visible', 'precio', 'talles', 'orden', 'actualizado'],
  variantes: ['slug', 'idx', 'nombre', 'sku', 'swatch', 'fotos', 'precio', 'precios_talle', 'agotados', 'agotado', 'talles'],
};

const ORDEN_TALLES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
const ordenarTalles = (ts) => [...new Set(ts)].sort((a, b) => {
  const ia = ORDEN_TALLES.indexOf(a), ib = ORDEN_TALLES.indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return parseFloat(a) - parseFloat(b) || String(a).localeCompare(String(b));
});
const csv = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const bool = (v) => v === true || /^(true|verdadero|si|sí|1)$/i.test(String(v).trim());
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
const json = (v, def) => { if (v && typeof v === 'object') return v; try { return v ? JSON.parse(v) : def; } catch { return def; } };

/** Orden de cada producto en su landing, según la primera tarjeta en la categoría (respeta el orden curado). */
export function ordenes(catalogo, categorias) {
  const out = {};
  for (const c of categorias) {
    c.tarjetas.forEach((k, i) => {
      const slug = catalogo.tarjeta_slug[k];
      if (slug && out[slug] == null) out[slug] = (i + 1) * 10;
    });
  }
  return out;
}

/** Repo → filas de la planilla. */
export function aFilas(catalogo, categorias, config, hoy = new Date().toISOString().slice(0, 10)) {
  const ord = ordenes(catalogo, categorias);
  const productos = [], variantes = [];
  for (const p of catalogo.productos) {
    const tallesProd = ordenarTalles(p.colores.flatMap((c) => c.talles.map((t) => t.talle)));
    productos.push({
      slug: p.slug, nombre: p.nombre, categoria: p.categoria, subcategoria: p.subcategoria, sku: p.sku, descripcion: p.descripcion,
      visible: true, precio: p.precio_minorista, talles: tallesProd.join(','), orden: ord[p.slug] ?? p.orden, actualizado: hoy,
    });
    p.colores.forEach((c, idx) => {
      const propios = c.talles.map((t) => t.talle);
      variantes.push({
        slug: p.slug, idx, nombre: c.nombre, sku: c.sku, swatch: c.muestra, fotos: c.fotos.join('|'),
        precio: c.precio ?? '', precios_talle: c.precios_talle && Object.keys(c.precios_talle).length ? JSON.stringify(c.precios_talle) : '',
        agotados: c.talles.filter((t) => t.estado === 'agotado').map((t) => t.talle).join(','), agotado: false,
        talles: propios.join(',') === tallesProd.join(',') ? '' : propios.join(','),
      });
    });
  }
  return { productos, variantes, config: { ws_minimo: config.ws_minimo, ws_envio: config.ws_envio, ws_texto: config.ws_texto, ultima_publicacion: '' } };
}

const titleCase = (t) => t.toLowerCase().replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase());

/**
 * API + repo → catálogo de la web.
 * @param api { productos, variantes, config } con solo lo publicado y visible
 * @param base catálogo del repo (aporta textos largos, specs, FAQ, guía, tarjetas curadas)
 * @param resolverFoto (valor de la celda) => nombre de archivo en src/assets/tc, o null
 */
export function combinar(api, base, categoriasBase, resolverFoto) {
  const porSlug = Object.fromEntries(base.productos.map((p) => [p.slug, p]));
  const catPorTitulo = Object.fromEntries(categoriasBase.map((c) => [c.titulo, c]));
  const tarjetaSlug = {};
  const productos = [];

  // Se respeta el orden del repo (feeds, llms, búsqueda); los productos nuevos van al final, por `orden`.
  const posBase = (s) => { const i = base.productos.findIndex((p) => p.slug === s); return i < 0 ? 9999 : i; };
  const filas = [...api.productos].filter((r) => bool(r.visible) && r.slug)
    .sort((a, b) => posBase(a.slug) - posBase(b.slug) || (num(a.orden) ?? 9999) - (num(b.orden) ?? 9999));
  for (const r of filas) {
    const b = porSlug[r.slug];
    const tallesProd = ordenarTalles(csv(r.talles));
    const vars = api.variantes.filter((v) => v.slug === r.slug).sort((x, y) => (num(x.idx) ?? 0) - (num(y.idx) ?? 0));
    const colores = vars.map((v) => {
      const propios = csv(v.talles);
      const talles = propios.length ? ordenarTalles(propios) : tallesProd;
      const agotados = csv(v.agotados);
      return {
        nombre: String(v.nombre).trim(), sku: String(v.sku || r.sku).trim(), muestra: v.swatch || '#2F3530',
        fotos: String(v.fotos || '').split('|').map((x) => x.trim()).filter(Boolean).map(resolverFoto).filter(Boolean),
        // El estado de stock se conserva pero la web no lo muestra (decisión con Walter).
        talles: talles.map((t) => ({ talle: t, estado: agotados.includes(t) ? 'agotado' : 'disponible' })),
        agotado: bool(v.agotado),
        precio: num(v.precio), precios_talle: json(v.precios_talle, {}),
      };
    });
    if (!colores.length) continue;
    const precio = num(r.precio) ?? b?.precio_minorista ?? 0;
    const nombre = String(r.nombre || b?.nombre || r.slug).trim();
    const categoria = String(r.categoria || b?.categoria || '').trim().toUpperCase();
    const cat = catPorTitulo[categoria];
    const p = b ? structuredClone(b) : {
      slug: r.slug, titulo: [nombre.toUpperCase()], seo: { titulo: null, descripcion: null }, descripcion_larga: [], caracteristicas: [], funciones: [],
      cifra_destacada: null, usos: [], usos_detalle: [], medidas: [], medidas_nota: null, incluye: null, distribucion: null, beneficios: [],
      especificaciones: [], faq: [], relacionados_tarjetas: [], relacionados: [], guia: null, tarjetas: [],
      opciones: { es_calzado: categoria === 'CALZADO', es_indumentaria: categoria === 'INDUMENTARIA', consulta_whatsapp_talle: false, info_altura: false, columnas_talle: null, nota_talle: null, proporcion_foto: null },
    };
    if (b && nombre !== b.nombre) p.titulo = [nombre.toUpperCase()];
    const migas = ['Inicio', cat ? titleCase(cat.titulo) : titleCase(categoria), titleCase(r.subcategoria || ''), nombre].filter(Boolean).join(' / ');
    const sinCambios = b && b.nombre === nombre && b.categoria === categoria && b.subcategoria === String(r.subcategoria || '').trim().toUpperCase();
    Object.assign(p, {
      nombre, categoria, subcategoria: String(r.subcategoria || '').trim().toUpperCase(), sku: String(r.sku || '').trim(),
      descripcion: String(r.descripcion || b?.descripcion || '').trim(), orden: num(r.orden) ?? 9999, actualizado: r.actualizado ? String(r.actualizado).slice(0, 10) : null,
      // Sigue siendo "de referencia" hasta que Walter le cambie el precio.
      precio_minorista: precio, precio_transferencia: precio, precio_provisorio: !!b?.precio_provisorio && precio === b.precio_minorista,
      migas: sinCambios ? b.migas : migas,
      colores,
    });
    // Producto nuevo (solo en la planilla): especificaciones mínimas para que la sección no quede vacía.
    if (!b) {
      const tallesTodos = ordenarTalles(colores.flatMap((c) => c.talles.map((t) => t.talle)));
      p.especificaciones = [
        { k: 'PRODUCTO', v: nombre },
        { k: colores.length > 1 ? 'COLORES' : 'COLOR', v: colores.map((c) => titleCase(c.nombre)).join(', ') },
        ...(tallesTodos.length ? [{ k: 'TALLES', v: tallesTodos.join(', ') }] : []),
        { k: 'SKU', v: p.sku },
      ];
    }
    p.opciones = { ...p.opciones, con_talles: colores.some((c) => c.talles.length > 0) };
    if (p.opciones.con_talles && !p.opciones.columnas_talle) p.opciones.columnas_talle = Math.min(Math.max(...colores.map((c) => c.talles.length)), 9);
    // Una tarjeta por color: se reutilizan las curadas (clave y nombre) y se crean las que falten.
    const viejas = b ? b.tarjetas : [];
    // Los colores que ya existían sin tarjeta propia (ej. Uniforme Gris Topo Ripstop) siguen sin tarjeta.
    const sinTarjeta = new Set((b?.colores || []).map((c) => c.nombre).filter((n) => b.colores.length > 1 && !viejas.some((x) => x.color === n)));
    p.tarjetas = colores.flatMap((c, i) => {
      const t = viejas.find((x) => x.color === c.nombre && !x.rota) || (colores.length === 1 ? viejas.find((x) => !x.rota) : null);
      if (!t && sinTarjeta.has(c.nombre)) return [];
      const clave = t?.clave || `${p.slug}--${i}`;
      tarjetaSlug[clave] = p.slug;
      const nombreTarjeta = t && b && nombre === b.nombre ? t.nombre : colores.length > 1 ? `${nombre} ${titleCase(c.nombre.replace(' · ', ' '))}` : nombre;
      return [{ clave, nombre: nombreTarjeta, color: colores.length > 1 ? c.nombre : t?.color ?? null, imagen: c.fotos[0] || null }]; // portada = primera foto del color, como la ficha
    });
    // Tarjeta extra de portada (ej. Gore-Tex que rota fotos de todos los colores).
    for (const t of viejas) if (t.rota) { p.tarjetas.push(t); tarjetaSlug[t.clave] = p.slug; }
    const posT = (t) => { const i = viejas.findIndex((x) => x.clave === t.clave); return i < 0 ? 999 : i; };
    p.tarjetas.sort((x, y) => posT(x) - posT(y));
    productos.push(p);
  }

  // Tarjetas "próximamente" del repo (sin ficha, apuntan a "#").
  for (const [k, v] of Object.entries(base.tarjeta_slug)) if (v === '#') tarjetaSlug[k] = '#';
  const vivas = new Set(Object.keys(tarjetaSlug));
  for (const p of productos) {
    p.relacionados_tarjetas = (p.relacionados_tarjetas || []).filter((k) => vivas.has(k));
    p.relacionados = [...new Set(p.relacionados_tarjetas.map((k) => tarjetaSlug[k]))];
  }

  // Categorías: tarjetas ordenadas por el `orden` del producto; dentro del producto, por color.
  const ordenProd = Object.fromEntries(productos.map((p) => [p.slug, p.orden]));
  const categorias = categoriasBase.map((c) => {
    const claves = productos.filter((p) => p.categoria === c.titulo).flatMap((p) => p.tarjetas.filter((t) => !t.rota || c.tarjetas.includes(t.clave)).map((t) => t.clave));
    const pos = (k) => c.tarjetas.indexOf(k);
    claves.sort((a, b) => (ordenProd[tarjetaSlug[a]] - ordenProd[tarjetaSlug[b]]) || ((pos(a) < 0 ? 999 : pos(a)) - (pos(b) < 0 ? 999 : pos(b))));
    const sub_mapa = {};
    for (const [sub, ks] of Object.entries(c.sub_mapa)) sub_mapa[sub] = claves.filter((k) => ks.includes(k));
    // Productos nuevos: van a la subcategoría cuyo nombre coincida con el inicio de su subcategoría.
    for (const k of claves) {
      if (Object.values(sub_mapa).some((ks) => ks.includes(k))) continue;
      const p = productos.find((x) => x.slug === tarjetaSlug[k]);
      const sub = Object.keys(sub_mapa).find((s) => p.subcategoria.startsWith(s.replace(/S$/, '')));
      if (sub) sub_mapa[sub].push(k);
    }
    return { ...c, tarjetas: claves, sub_mapa };
  });

  const cfg = api.config || {};
  const config = {
    _nota: 'Generado desde la hoja `config` de la planilla.',
    ws_minimo: num(cfg.ws_minimo) ?? 8,
    ws_envio: cfg.ws_envio || 'A cargo del comprador · se cotiza por WhatsApp',
    ws_texto: cfg.ws_texto || '',
  };
  return { catalogo: { ...base, _nota: 'Generado en el build desde la planilla (ver scripts/sincronizar-catalogo.mjs).', productos, tarjeta_slug: tarjetaSlug }, categorias, config };
}
