// Tipos y lógica del panel que no dependen de la pantalla: estados, mensajes de WhatsApp, formatos y fotos.

export type Item = { n: string; sku: string; qty: number; price: number };
export type Pedido = {
  codigo: string; fecha_alta: string; cliente_id: string; nombre: string; telefono: string; items: Item[];
  destino: string; entrega: string; tipo: string; estado: number;
  f_confirmado: string; f_preparacion: string; f_despacho: string; f_entrega: string;
  avisado_0: boolean; avisado_1: boolean; avisado_2: boolean; avisado_3: boolean;
  transporte: string; guia: string; total_ref: number; nota: string;
};
export type Cliente = { id: string; nombre: string; telefono: string; localidad: string; tipo: string; cuit: string; nota: string; alta: string };
export type Foto = { id: string; url: string };
export type Color = { nombre: string; sku: string; muestra: string; fotos: Foto[]; talles: string[]; ninos: string[]; precio: number | null; precios_talle: Record<string, number>; agotado: boolean; agotados: string[] };
/** Sin stock: el color entero, o todos sus talles marcados. */
export const colorSinStock = (c: Color) => c.agotado || (c.talles.length + c.ninos.length > 0 && [...c.talles, ...c.ninos].every((t) => c.agotados.includes(t)));
export const stockDe = (p: Producto): 'ok' | 'parcial' | 'sin' => (p.colores.every(colorSinStock) ? 'sin' : p.colores.some((c) => c.agotado || c.agotados.length) ? 'parcial' : 'ok');
export type Ficha = { descripcion: string; descripcion_larga: string[]; caracteristicas: string[]; especificaciones: { k: string; v: string }[]; faq: { q: string; a: string }[] };
export type Producto = { slug: string; nombre: string; categoria: string; subcategoria: string; sku: string; visible: boolean; precio: number; orden: number; actualizado: string; pendiente: boolean; notas: string; ficha: Ficha; colores: Color[] };

export const CATEGORIAS = ['INDUMENTARIA', 'EQUIPOS TÁCTICOS', 'CALZADO', 'ACCESORIOS'];
export const TRANSPORTES = ['ANDREANI', 'OCA', 'CORREO ARGENTINO', 'VÍA CARGO', 'OTRO', 'RETIRO EN RAFAELA', 'ENVÍO DENTRO DE RAFAELA'];
export const LOCALES = ['RETIRO EN RAFAELA', 'ENVÍO DENTRO DE RAFAELA'];
export const PASOS = ['Confirmado', 'En preparación', 'Despachado', 'Entregado'];
export const FECHAS = ['f_confirmado', 'f_preparacion', 'f_despacho', 'f_entrega'] as const;

/** Nombre del paso 3 según el transporte (los locales no se «despachan»). */
export const nombrePaso = (p: Pick<Pedido, 'transporte'>, i: number) =>
  i === 2 && p.transporte === 'RETIRO EN RAFAELA' ? 'Listo para retirar' : i === 2 && p.transporte === 'ENVÍO DENTRO DE RAFAELA' ? 'En camino' : PASOS[i];

export const QUE_SIGUE = [
  'Mandale al cliente su código de seguimiento. Cuando empieces a armar el paquete, pasalo a «En preparación».',
  'Estás armando el pedido. Cuando sale de Rafaela (o queda listo para retirar), elegí el transporte y pasalo al paso siguiente.',
  'El pedido está en camino. Cuando el cliente lo reciba, marcalo como entregado.',
  'Pedido cerrado. No hay nada más que hacer.',
];

/** «BOLSOS Y MOCHILAS TÁCTICAS» → «Bolsos y Mochilas Tácticas»; «VÍA CARGO» → «Vía Cargo». */
export const cap = (s: string) =>
  s.toLowerCase().replace(/(^|\s)(\S+)/g, (m, a, w, i) => (i > 0 && ['y', 'de', 'del', 'la', 'el', 'en', 'a', 'dentro'].includes(w) ? m : a + w.charAt(0).toUpperCase() + w.slice(1)));
export const money = (n: number) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
export const fecha = (iso: string) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '');
export const fechaHora = (iso: string) => (iso ? new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '');
export const digitos = (t: string) => String(t || '').replace(/\D/g, '');
export const avisado = (p: Pedido, i: number) => !!(p as unknown as Record<string, boolean>)[`avisado_${i}`];
export const faltaAvisar = (p: Pedido) => !avisado(p, p.estado);

/** wa.me con el número en formato internacional argentino (549 + área + número). */
export function linkWhatsApp(tel: string, texto: string) {
  let d = digitos(tel);
  if (d.startsWith('549')) d = d.slice(3);
  else if (d.startsWith('54')) d = d.slice(2);
  d = d.replace(/^0/, '').replace(/^(\d{2,4})15/, '$1');
  return `https://wa.me/549${d.slice(-10)}?text=${encodeURIComponent(texto)}`;
}

/** Mensaje de cada paso. El seguimiento pide solo el código (sin los dígitos del teléfono). */
export function mensaje(p: Pedido, paso: number, sitio: string) {
  const n = p.nombre.split(' ')[0];
  const seguir = `${sitio}/envios/`;
  if (paso === 0) return `Hola ${n}! Confirmamos tu compra en Tactical Command.\nTu código de pedido es: ${p.codigo}\nPodés seguirlo en ${seguir} con ese código.`;
  if (paso === 1) return `Hola ${n}! Tu pedido ${p.codigo} ya está en preparación. Te avisamos cuando esté en camino.`;
  if (paso === 2) {
    if (p.transporte === 'RETIRO EN RAFAELA') return `Hola ${n}! Tu pedido ${p.codigo} ya está listo para retirar en Rafaela. Coordinamos por acá el día y el horario.`;
    if (p.transporte === 'ENVÍO DENTRO DE RAFAELA') return `Hola ${n}! Tu pedido ${p.codigo} ya salió para tu domicilio.`;
    return `Hola ${n}! Tu pedido ${p.codigo} fue despachado desde Rafaela por ${cap(p.transporte)}.\nNúmero de guía: ${p.guia}\nSeguimiento: ${seguir}`;
  }
  return `Hola ${n}! Tu pedido ${p.codigo} figura como entregado. ¡Gracias por elegir Tactical Command!`;
}

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function nuevoCodigo(usados: Set<string>) {
  const d = new Date();
  const pre = `TC-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-`;
  for (;;) {
    let c = pre;
    for (let i = 0; i < 4; i++) c += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
    if (!usados.has(c)) return c;
  }
}

/** Semáforo de calidad de una ficha: qué le falta para rendir en Google y en la venta. */
export function calidad(p: Producto) {
  const f = p.ficha;
  const fotosMin = Math.min(...p.colores.map((c) => c.fotos.length));
  const items = [
    { ok: f.descripcion.trim().length >= 120, t: 'Descripción corta de 120 caracteres o más', falta: `tiene ${f.descripcion.trim().length}` },
    { ok: f.descripcion_larga.filter((x) => x.trim()).length >= 2, t: 'Descripción larga de 2 párrafos o más' },
    { ok: f.caracteristicas.filter((x) => x.trim()).length >= 3, t: '3 características o más' },
    { ok: f.especificaciones.filter((x) => x.k.trim() && x.v.trim()).length >= 5, t: '5 especificaciones o más' },
    { ok: f.faq.filter((x) => x.q.trim() && x.a.trim()).length >= 3, t: '3 preguntas frecuentes o más' },
    { ok: fotosMin >= 3, t: '3 fotos o más en cada color', falta: `hay colores con ${fotosMin}` },
  ];
  const n = items.filter((x) => x.ok).length;
  return { items, n, total: items.length, nivel: n === items.length ? 'ok' : n >= 4 ? 'medio' : 'bajo' };
}

/** Comprime una foto en el celular antes de subirla: WebP de hasta 1600 px. */
export async function comprimirFoto(file: File): Promise<{ url: string; blob: Blob; ancho: number; alto: number; chica: boolean }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/webp', 0.86));
  return { url: URL.createObjectURL(blob), blob, ancho: bmp.width, alto: bmp.height, chica: Math.min(bmp.width, bmp.height) < 1200 };
}
