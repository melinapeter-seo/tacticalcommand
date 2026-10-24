// Regenera src/data/*.json a partir del prototipo de diseño (design/Tactical Command v2.dc.html).
// El HTML es la fuente de verdad del contenido (ver design/HANDOFF.md, paso 0).
// Uso: node scripts/catalogo-desde-prototipo.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('design/Tactical Command v2.dc.html', 'utf8');
const start = html.indexOf('>', html.indexOf('<script type="text/x-dc"')) + 1;
const code = html.slice(start, html.indexOf('class Component extends DCLogic'));

const ctx = {
  window: {}, location: { href: 'https://tacticalcommand.com.ar/' },
  document: { getElementById: () => 1, createElement: () => ({}), head: { appendChild() {} } },
  localStorage: { getItem: () => null }, console,
};
vm.createContext(ctx);
const names = ['PROD', 'CATS', 'PDPS', 'GUIDES', 'LEGAL_DOCS', 'LEGAL', 'CK_CATS', 'LINKS', 'TC_SOCIAL', 'TC_MAIL', 'TC_WA_T', 'WA_NUM'];
// ROT (tarjeta que rota fotos) se define después del pisado de precios: lo replicamos acá.
const ROT = { gtex: ['campera-green-od.webp', 'campera-green-od-3.webp', 'campera-gtex-negra.webp', 'campera-gtex-negra-3.webp'] };
// El prototipo pisa todos los precios con TC_PRICE_TEMP; leemos los datos antes de ese paso.
const raw = code.slice(0, code.indexOf('const TC_PRICE_TEMP'));
const D = vm.runInContext(raw + `\n;({${names.join(',')}})`, ctx);

const foto = (p) => (typeof p === 'string' && p.startsWith('uploads/') ? p.replace(/^uploads\/(TC\/)?/, '') : null);
const slugDe = (to) => (to || '').replace(/^#\/productos\//, '').split(/[/?]/)[0];
const colorDe = (to) => { const m = (to || '').match(/[?&]color=([^&]+)/); return m ? decodeURIComponent(m[1]) : null; };
const ruta = (to) => (to || '').replace(/^#/, '').replace(/\?.*$/, '');
const ORDEN_TALLES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
const PRECIO_PROVISORIO = 50000;

// Tarjetas de listado: una por clave de PROD que aparezca en alguna categoría, en la home o en relacionados.
const usadas = new Set([
  ...Object.values(D.CATS).flatMap((c) => c.items),
  ...Object.values(D.PDPS).flatMap((p) => p.related || []),
  ...D.GUIDES.flatMap((g) => g.prods || []),
  'gtexng', 'mocam', 'altama', 'unimp', 'cintocy', 'mocb70c', 'pantr', 'gafas', 'shemagh', 'gtexod', 'unigt', 'moc45vm', 'sombrero', 'chalmlmc', 'bandng',
]);

const productos = Object.entries(D.PDPS).map(([slug, p], orden) => {
  const [categoria, subcategoria = ''] = (p.eyebrow || '').split(' / ');
  const precio = PRECIO_PROVISORIO; // precio de referencia para todos; los reales se cargan desde el panel
  const colores = p.colors.map((c) => {
    const listados = [...c.ok, ...c.off, ...c.req, ...c.spec];
    const todos = [...ORDEN_TALLES.filter((t) => listados.includes(t)), ...listados.filter((t, i) => !ORDEN_TALLES.includes(t) && listados.indexOf(t) === i).sort((a, b) => parseFloat(a) - parseFloat(b))];
    return {
      nombre: c.n, sku: c.sku || p.sku, muestra: c.sw,
      fotos: c.g.map(foto).filter(Boolean),
      talles: todos.map((t) => ({ talle: t, estado: c.off.includes(t) ? 'agotado' : c.req.includes(t) ? 'bajo_pedido' : c.spec.includes(t) ? 'consultar' : 'disponible' })),
    };
  });
  const tarjetas = Object.entries(D.PROD)
    .filter(([k, v]) => usadas.has(k) && slugDe(v.to) === slug)
    .map(([k, v]) => {
      const color = colorDe(v.to);
      const col = colores.find((c) => c.nombre === color) || colores[0];
      return { clave: k, nombre: v.n, color, imagen: foto(v.img) || (col && col.fotos[0]) || null, rota: ROT[k] || undefined };
    });
  return {
    slug, nombre: p.crumbs.split(' / ').pop(), titulo: [p.n1, p.n2], categoria, subcategoria, sku: p.sku, orden: (orden + 1) * 10,
    precio_minorista: precio, precio_transferencia: precio, precio_provisorio: true,
    migas: p.crumbs, seo: { titulo: p.seoT || null, descripcion: p.seoD || null },
    descripcion: p.p0, descripcion_larga: p.long || [], caracteristicas: p.keys || [],
    funciones: (p.func || []).map(([titulo, texto, destacado]) => ({ titulo, texto, destacado: destacado || null })),
    cifra_destacada: p.bigFig || null,
    usos: p.uses || [], usos_detalle: (p.usesD || []).map(([titulo, texto]) => ({ titulo, texto })),
    medidas: (p.dims || []).map(([valor, etiqueta]) => ({ valor, etiqueta })), medidas_nota: p.dimsNote || null, incluye: p.incl || null,
    distribucion: p.dist ? { titulo: p.distT || null, etiqueta: p.distL || null, items: p.dist.map(([titulo, texto]) => ({ titulo, texto })) } : null,
    beneficios: (p.ben || []).map(([titulo, texto]) => ({ titulo, texto })),
    especificaciones: p.specs.map(([k, v]) => ({ k, v })),
    faq: p.qa.map(([q, a]) => ({ q, a })),
    relacionados_tarjetas: p.related || [],
    relacionados: [...new Set((p.related || []).map((k) => slugDe(D.PROD[k] && D.PROD[k].to)).filter(Boolean))],
    guia: p.guide ? { url: ruta(p.guide).replace('/blog/', '/guias/'), titulo: p.guideT || null, imagen: foto(p.guideImg) } : null,
    opciones: {
      con_talles: !p.noSizes, es_calzado: !!p.shoe, es_indumentaria: !!p.apparel, consulta_whatsapp_talle: !!p.waNote,
      info_altura: !!p.tallInfo, columnas_talle: p.sizeCols || null, nota_talle: p.sizeNote || null, proporcion_foto: p.ar || null,
    },
    colores, tarjetas,
  };
});

const tarjetaSlug = Object.fromEntries(Object.entries(D.PROD).map(([k, v]) => [k, slugDe(v.to)]));
const categorias = Object.entries(D.CATS).map(([slug, c]) => ({
  slug, titulo: c.t, numero: c.i, imagen: foto(c.img), seo_titulo: c.seoT || null, descripcion: c.d, frase: c.brk,
  subcategorias: c.subs, sub_mapa: c.subMap || {}, tarjetas: c.items,
  comparativa: c.cmp ? { titulo: c.cmp.cap, encabezados: c.cmp.head, filas: c.cmp.rows.map((r) => ({ nombre: r[0], url: ruta(r[1]), celdas: r.slice(2) })) } : null,
  faq: (c.faq || []).map(([q, a]) => ({ q, a })),
  guias: c.guides || [],
}));

const guias = D.GUIDES.map((g) => ({
  slug: g.slug, titulo: g.t, h1: g.h1, cluster: g.cl, palabra_clave: g.kw, lectura: g.rt,
  imagen: foto(g.hero), galeria: (g.gal || []).map(foto).filter(Boolean),
  respuesta: g.ans, puntos: g.pts, secciones: g.secs, tabla: g.tbl,
  faq: (g.faq || []).map(([q, a]) => ({ q, a })),
  productos: (g.prods || []).filter((k) => D.PROD[k]), categoria: { texto: g.catT, url: ruta(g.catTo) },
  ...Object.fromEntries(Object.entries(g).filter(([k]) => !['slug', 't', 'h1', 'cl', 'kw', 'rt', 'hero', 'gal', 'ans', 'pts', 'secs', 'tbl', 'faq', 'prods', 'catT', 'catTo', 'to'].includes(k))),
}));

const legales = D.LEGAL_DOCS.map((d) => ({ slug: d.slug, titulo: d.t, ...D.LEGAL[d.slug] }));

const sitio = {
  nombre: 'Tactical Command', whatsapp: D.WA_NUM, whatsapp_texto: D.TC_WA_T, email: D.TC_MAIL,
  redes: D.TC_SOCIAL, cookies: D.CK_CATS, enlaces_legales: D.LINKS.map(([t, to]) => ({ t, url: ruta(to).replace('/blog/', '/guias/') })),
};

const out = (f, v) => { fs.writeFileSync(`src/data/${f}`, JSON.stringify(v, null, 1) + '\n'); console.log(f, Array.isArray(v) ? v.length : Object.keys(v).length); };
out('catalog.json', { _nota: 'Fuente única del catálogo. Generado desde el prototipo con scripts/catalogo-desde-prototipo.mjs; en la fase 2 se reemplaza por la lectura de Google Sheets con la misma forma. El estado de stock NO se muestra en la web.', productos, tarjeta_slug: tarjetaSlug });
out('categorias.json', categorias);
out('guias.json', guias);
out('legales.json', legales);
out('sitio.json', sitio);
