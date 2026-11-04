import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { productos } from '../../lib/data';
import { img } from '../../lib/img';

// Datos del modo demostración del panel: el catálogo real (con su contenido largo) y pedidos y clientes de ejemplo.
// No se publica en el sitemap y /panel/ está bloqueado en robots.txt.

const miniatura = async (f: string) => {
  const m = await img(f);
  return m ? (await getImage({ src: m, width: 320, format: 'webp' })).src : null;
};

const hace = (dias: number, horas = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(horas, 15, 0, 0);
  return d.toISOString();
};

export const GET: APIRoute = async () => {
  const fotos: Record<string, string> = {};
  for (const p of productos) for (const c of p.colores) for (const f of c.fotos) if (!fotos[f]) fotos[f] = (await miniatura(f)) || '';

  const productosPanel = productos.map((p, i) => ({
    slug: p.slug, nombre: p.nombre, categoria: p.categoria, subcategoria: p.subcategoria, sku: p.sku, visible: true,
    precio: p.precio_minorista, orden: (i + 1) * 10,
    ficha: {
      descripcion: p.descripcion, descripcion_larga: p.descripcion_larga, caracteristicas: p.caracteristicas,
      especificaciones: p.especificaciones, faq: p.faq,
    },
    colores: p.colores.map((c) => ({
      nombre: c.nombre, sku: c.sku, muestra: c.muestra, fotos: c.fotos.map((f) => ({ id: f, url: fotos[f] })),
      talles: c.talles.filter((t) => !t.ninos).map((t) => t.talle),
      ninos: c.talles.filter((t) => t.ninos).map((t) => t.talle),
      precio: null as number | null, precios_talle: {} as Record<string, number>,
    })),
  }));

  const clientes = [
    { id: 'c1', nombre: 'Martín Gómez', telefono: '3492 556677', localidad: 'Córdoba Capital', tipo: 'MINORISTA', cuit: '', nota: '', alta: hace(40) },
    { id: 'c2', nombre: 'Armería Sur', telefono: '11 4444 5555', localidad: 'Bahía Blanca', tipo: 'MAYORISTA', cuit: '30-71234567-8', nota: 'Paga por transferencia.', alta: hace(90) },
    { id: 'c3', nombre: 'Lucía Fernández', telefono: '3492 401122', localidad: 'Rafaela', tipo: 'MINORISTA', cuit: '', nota: '', alta: hace(12) },
    { id: 'c4', nombre: 'Diego Ríos', telefono: '341 600 1234', localidad: 'Rosario', tipo: 'MINORISTA', cuit: '', nota: '', alta: hace(5) },
  ];
  const item = (n: string, sku: string, qty: number, price = 50000) => ({ n, sku, qty, price });
  const pedido = (codigo: string, c: (typeof clientes)[number], dias: number, estado: number, items: ReturnType<typeof item>[], extra: Record<string, unknown> = {}) => ({
    codigo, fecha_alta: hace(dias), cliente_id: c.id, nombre: c.nombre, telefono: c.telefono, items,
    destino: c.localidad, entrega: 'DOMICILIO', tipo: c.tipo, estado,
    f_confirmado: hace(dias), f_preparacion: estado >= 1 ? hace(dias - 1) : '', f_despacho: estado >= 2 ? hace(Math.max(dias - 2, 0)) : '', f_entrega: estado >= 3 ? hace(0, 9) : '',
    avisado_0: true, avisado_1: estado > 1, avisado_2: estado > 2, avisado_3: false,
    transporte: '', guia: '', total_ref: items.reduce((a, x) => a + x.qty * x.price, 0), nota: '', ...extra,
  });
  const pedidos = [
    pedido('TC-2611-7KQ4', clientes[3], 0, 0, [item('Borcego Táctico Ranger Negro · Negro · Nro 42', 'TC-BOR-RNG-NG', 1)], { avisado_0: false }),
    pedido('TC-2611-3HMP', clientes[0], 2, 1, [item('Campera Gore-Tex · Negro · Talle L', 'TC-GTEX-001-NG', 1), item('Cinto Táctico Negro', 'TC-CIN-COB-NG', 1)]),
    pedido('TC-2610-W8ZA', clientes[1], 6, 2, [item('Bajo Chaleco Manga Larga Negro · Talle M', 'TC-CHA-ML-NG', 6), item('Bajo Chaleco Manga Larga Negro · Talle L', 'TC-CHA-ML-NG', 6)],
      { tipo: 'MAYORISTA', entrega: 'SUCURSAL', transporte: 'ANDREANI', guia: '360002148795', avisado_2: false }),
    pedido('TC-2610-QT5N', clientes[2], 9, 3, [item('Sombrero de Monte · Woodland · Talle M', 'TC-SOM-BOO-WD', 1)], { transporte: 'RETIRO EN RAFAELA', avisado_3: true }),
  ];

  return new Response(JSON.stringify({ productos: productosPanel, pedidos, clientes, config: { ws_minimo: 8, envio_rafaela: 5000, soporte_whatsapp: '5493492686435' } }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
