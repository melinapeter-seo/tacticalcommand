// Contenido de /llms.txt y /llms-full.txt: qué es Tactical Command y cómo comprar, en Markdown.
import config from '../data/config.json';
import { SITE, productos, categorias, guias, money, sitio } from './data';
import { EMAIL } from './seo';

export function llms(full: boolean) {
  const L: string[] = [];
  L.push('# Tactical Command', '');
  L.push('> Tienda argentina de indumentaria, equipos tácticos, calzado y accesorios para fuerzas de seguridad, trabajo, entrenamiento y outdoor. Opera desde 2012 en Rafaela, Santa Fe, vende por menor y por mayor y hace envíos a todo el país.', '');
  L.push('## Datos clave', '');
  L.push('- Ubicación: Rafaela, Santa Fe, Argentina (opera de forma digital; sin local a la calle).');
  L.push('- En el rubro desde: 2012.');
  L.push(`- Cómo se compra: se elige producto, color y talle en la web y se envía el pedido por WhatsApp (${sitio.whatsapp_texto}). Por WhatsApp se confirman stock, precio final, forma de pago y envío. No hay pago online.`);
  L.push(`- Venta mayorista: desde ${config.ws_minimo} unidades combinables entre productos, colores y talles. El precio mayorista final se confirma por WhatsApp. Portal: ${SITE}/mayoristas/`);
  L.push(`- Envíos: a todo el país desde Rafaela, a domicilio o a sucursal. ${config.ws_envio}.`);
  L.push(`- Seguimiento de pedidos: ${SITE}/envios/ (con el código de pedido que se recibe por WhatsApp).`);
  L.push(`- Arrepentimiento: 10 días corridos, sin motivo y sin costo (Ley 24.240). ${SITE}/arrepentimiento/`);
  L.push(`- Contacto: WhatsApp ${sitio.whatsapp_texto} · ${EMAIL}`);
  L.push('- Horario: lunes a viernes de 8 a 12 y de 16 a 20 hs; sábados y domingos de 9 a 15 hs.', '');
  L.push('## Categorías', '');
  for (const c of categorias) L.push(`- [${c.titulo}](${SITE}/${c.slug}/): ${c.descripcion}`);
  L.push('', '## Productos', '');
  for (const p of productos) {
    L.push(`- [${p.nombre}](${SITE}/productos/${p.slug}/) — ${money(p.precio_minorista)}${p.precio_provisorio ? ' (precio de referencia, se confirma por WhatsApp)' : ''}. ${p.descripcion}`);
    if (full) {
      if (p.colores.length > 1) L.push(`  - Colores: ${p.colores.map((c) => c.nombre).join(', ')}.`);
      const t = [...new Set(p.colores.flatMap((c) => c.talles.map((x) => x.talle)))];
      if (t.length) L.push(`  - Talles: ${t.join(', ')}.`);
      for (const s of p.especificaciones) L.push(`  - ${s.k.charAt(0) + s.k.slice(1).toLowerCase()}: ${s.v}`);
      for (const f of p.faq) L.push(`  - P: ${f.q} R: ${f.a}`);
    }
  }
  L.push('', '## Guías', '');
  for (const g of guias) {
    L.push(`- [${g.titulo}](${SITE}/guias/${g.slug}/): ${g.respuesta}`);
    if (full) for (const f of g.faq) L.push(`  - P: ${f.q} R: ${f.a}`);
  }
  if (!full) L.push('', `Versión extendida con especificaciones y preguntas frecuentes: ${SITE}/llms-full.txt`);
  return L.join('\n') + '\n';
}
