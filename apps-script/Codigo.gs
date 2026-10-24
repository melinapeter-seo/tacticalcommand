/**
 * Tactical Command — API sobre la planilla (Google Apps Script, Web App).
 *
 * Públicas (GET):  catalog · track · photo
 * Privadas (POST con token del login): login · getAll · saveDraft · publish · discardDraft ·
 *   createOrder · advanceOrder · undoStep · setGuia · markNotified · upsertClient · createClient · uploadPhoto
 * Respuesta: { ok: true, data } o { ok: false, error }.
 *
 * Script Properties: PIN (lo carga el menú «Configurar PIN»), TOKEN_SECRET (lo genera `instalar`),
 * DEPLOY_HOOK_URL (Build Hook de Netlify) y, opcional, SITE_URL para avisar a IndexNow.
 * Las columnas de productos/variantes y la semilla están en Semilla.gs (generado desde el repo).
 */

// ---------- Estructura ----------
// Función y no constante: Apps Script ejecuta cada archivo por separado y COLUMNAS vive en Semilla.gs.
const hojas = () => ({
  productos: COLUMNAS.productos,
  productos_draft: COLUMNAS.productos,
  variantes: COLUMNAS.variantes,
  variantes_draft: COLUMNAS.variantes,
  config: ['clave', 'valor'],
  config_draft: ['clave', 'valor'],
  pedidos: ['codigo', 'fecha_alta', 'cliente_id', 'nombre', 'telefono', 'items', 'destino', 'entrega', 'tipo', 'estado',
    'f_confirmado', 'f_preparacion', 'f_despacho', 'f_entrega', 'avisado_0', 'avisado_1', 'avisado_2', 'avisado_3',
    'transporte', 'guia', 'total_ref', 'nota'],
  clientes: ['id', 'nombre', 'telefono', 'localidad', 'tipo', 'cuit', 'nota', 'alta'],
});
const NUMERICAS = ['precio', 'orden', 'idx', 'estado', 'total_ref'];
const BOOLEANAS = ['visible', 'agotado', 'avisado_0', 'avisado_1', 'avisado_2', 'avisado_3'];
const CATEGORIAS = ['INDUMENTARIA', 'EQUIPOS TÁCTICOS', 'CALZADO', 'ACCESORIOS'];
const TRANSPORTES = ['ANDREANI', 'OCA', 'CORREO ARGENTINO', 'VÍA CARGO', 'OTRO', 'RETIRO EN RAFAELA', 'ENVÍO DENTRO DE RAFAELA'];
const LOCALES = ['RETIRO EN RAFAELA', 'ENVÍO DENTRO DE RAFAELA']; // sin guía
const FECHAS_PASO = ['f_confirmado', 'f_preparacion', 'f_despacho', 'f_entrega'];
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TOKEN_HORAS = 12;
const BUILD_MIN_ENTRE = 2 * 60 * 1000; // dos publicaciones en menos de 2 min = un solo build
const CARPETA = 'TC';

// ---------- Entrada ----------
function doGet(e) {
  return responder(() => {
    const p = e.parameter || {};
    if (p.action === 'catalog') return catalogo();
    if (p.action === 'track') return seguimiento(p.code);
    if (p.action === 'photo') return foto(p.id);
    throw new Error('Acción desconocida.');
  });
}

function doPost(e) {
  return responder(() => {
    // El panel manda text/plain para evitar el preflight de CORS, que Apps Script no atiende.
    const b = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (b.action === 'login') return login(b.pin);
    verificarToken(b.token);
    const acciones = {
      getAll: () => todo(),
      saveDraft: () => conLock(() => guardarBorrador(b)),
      publish: () => conLock(() => publicar()),
      discardDraft: () => conLock(() => descartarBorrador()),
      createOrder: () => conLock(() => crearPedido(b)),
      advanceOrder: () => conLock(() => avanzarPedido(b.code, b.transporte || b.carrier, b.guia)),
      undoStep: () => conLock(() => deshacerPaso(b.code)),
      setGuia: () => conLock(() => cargarGuia(b.code, b.transporte || b.carrier, b.guia)),
      markNotified: () => conLock(() => marcarAvisado(b.code, b.stage)),
      upsertClient: () => conLock(() => guardarCliente(b.cliente)),
      createClient: () => conLock(() => crearCliente(b.cliente)),
      uploadPhoto: () => subirFoto(b),
    };
    if (!acciones[b.action]) throw new Error('Acción desconocida.');
    return acciones[b.action]();
  });
}

function responder(fn) {
  let out;
  try { out = { ok: true, data: fn() }; } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function conLock(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('La planilla está ocupada, probá de nuevo en unos segundos.');
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------- Planilla ----------
const libro = () => SpreadsheetApp.getActiveSpreadsheet();
const prop = (k) => PropertiesService.getScriptProperties().getProperty(k);
const ahora = () => new Date().toISOString();

function hoja(nombre) {
  const h = libro().getSheetByName(nombre);
  if (!h) throw new Error(`Falta la hoja «${nombre}». Corré «Instalar / reparar» desde el menú Tactical Command.`);
  return h;
}

/** Filas como objetos. Las celdas vacías vuelven como ''. */
function leer(nombre) {
  const h = hoja(nombre);
  const n = h.getLastRow();
  if (n < 2) return [];
  const cols = hojas()[nombre];
  return h.getRange(2, 1, n - 1, cols.length).getValues()
    .filter((r) => r[0] !== '' && r[0] !== null) // la primera columna es la clave
    .map((r) => {
      const o = {};
      cols.forEach((c, i) => { o[c] = r[i] instanceof Date ? r[i].toISOString() : r[i]; });
      return o;
    });
}

/** Reemplaza todas las filas de la hoja. */
function escribir(nombre, filas) {
  const h = hoja(nombre);
  const cols = hojas()[nombre];
  const n = h.getLastRow();
  if (n > 1) h.getRange(2, 1, n - 1, h.getMaxColumns()).clearDataValidations().clearContent();
  if (!filas.length) return;
  h.getRange(2, 1, filas.length, cols.length).setValues(filas.map((o) => cols.map((c) => celda(c, o[c]))));
  casillas(h, nombre, 2, filas.length);
}

/** Casillas solo en las filas con datos (en filas vacías harían crecer getLastRow). */
function casillas(h, nombre, desde, n) {
  hojas()[nombre].forEach((c, i) => { if (BOOLEANAS.includes(c)) h.getRange(desde, i + 1, n, 1).insertCheckboxes(); });
}

function celda(col, v) {
  if (v === undefined || v === null) return BOOLEANAS.includes(col) ? false : '';
  if (BOOLEANAS.includes(col)) return v === true || /^(true|verdadero|si|sí|1)$/i.test(String(v));
  if (NUMERICAS.includes(col)) return v === '' || isNaN(Number(v)) ? '' : Number(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Actualiza una fila buscando por la columna clave. Devuelve la fila completa ya actualizada. */
function actualizar(nombre, clave, valor, cambios) {
  const h = hoja(nombre);
  const cols = hojas()[nombre];
  const k = cols.indexOf(clave);
  const n = h.getLastRow();
  const vals = n > 1 ? h.getRange(2, k + 1, n - 1, 1).getValues() : [];
  const i = vals.findIndex((r) => String(r[0]) === String(valor));
  if (i < 0) throw new Error('No se encontró el registro.');
  const fila = h.getRange(i + 2, 1, 1, cols.length);
  const actual = fila.getValues()[0];
  const o = {};
  cols.forEach((c, j) => { o[c] = actual[j] instanceof Date ? actual[j].toISOString() : actual[j]; });
  Object.assign(o, cambios);
  fila.setValues([cols.map((c) => celda(c, o[c]))]);
  return o;
}

function agregar(nombre, o) {
  const cols = hojas()[nombre];
  const h = hoja(nombre);
  h.appendRow(cols.map((c) => celda(c, o[c])));
  casillas(h, nombre, h.getLastRow(), 1);
  return o;
}

const leerConfig = (nombre) => Object.fromEntries(leer(nombre).map((r) => [r.clave, r.valor]));
const escribirConfig = (nombre, cfg) => escribir(nombre, Object.keys(cfg).map((k) => ({ clave: k, valor: cfg[k] })));

// ---------- Públicas ----------
function catalogo() {
  const cache = CacheService.getScriptCache();
  const enCache = cache.get('catalog');
  if (enCache) return JSON.parse(enCache);
  const productos = leer('productos').filter((p) => p.visible === true && p.slug);
  const slugs = new Set(productos.map((p) => p.slug));
  const data = { productos, variantes: leer('variantes').filter((v) => slugs.has(v.slug)), config: leerConfig('config') };
  const txt = JSON.stringify(data);
  if (txt.length < 95000) cache.put('catalog', txt, 60);
  return data;
}

/** Seguimiento: valida solo por código (decisión del cliente). Nunca expone nombre, ítems ni nota. */
function seguimiento(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!/^TC-\d{4}-[A-Z0-9]{4}$/.test(c)) throw new Error('Código inválido.');
  limitar('track', 120); // tope global por minuto (Apps Script no da la IP)
  const cache = CacheService.getScriptCache();
  const hit = cache.get('trk:' + c);
  if (hit) return JSON.parse(hit);
  const p = leer('pedidos').find((x) => String(x.codigo).toUpperCase() === c);
  if (!p) throw new Error('No encontramos ese pedido.');
  const data = { codigo: p.codigo, estado: Number(p.estado) || 0, fechas: FECHAS_PASO.map((f) => p[f] || null), transporte: p.transporte || null, guia: p.guia || null };
  cache.put('trk:' + c, JSON.stringify(data), 60);
  return data;
}

/** Foto para el build. Solo entrega archivos que estén dentro de TC/fotos. */
function foto(id) {
  if (!/^[\w-]{20,}$/.test(String(id || ''))) throw new Error('ID inválido.');
  const f = DriveApp.getFileById(id);
  const raiz = carpeta(['fotos']).getId();
  let dentro = false;
  const pila = [f.getParents()];
  for (let nivel = 0; nivel < 4 && pila.length && !dentro; nivel++) {
    const it = pila.shift();
    while (it.hasNext()) {
      const c = it.next();
      if (c.getId() === raiz) { dentro = true; break; }
      pila.push(c.getParents());
    }
  }
  if (!dentro) throw new Error('La foto no está en la carpeta TC/fotos.');
  const blob = f.getBlob();
  return { mime: blob.getContentType(), nombre: f.getName(), base64: Utilities.base64Encode(blob.getBytes()) };
}

function limitar(clave, maxPorMinuto) {
  const cache = CacheService.getScriptCache();
  const k = 'rl:' + clave + ':' + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(k) || 0) + 1;
  if (n > maxPorMinuto) throw new Error('Demasiadas consultas, probá en un minuto.');
  cache.put(k, String(n), 120);
}

// ---------- Sesión ----------
function login(pin) {
  const real = prop('PIN');
  if (!real) throw new Error('El PIN todavía no está configurado.');
  const cache = CacheService.getScriptCache();
  const fallos = Number(cache.get('login-fallos') || 0);
  if (fallos >= 10) throw new Error('Demasiados intentos. Esperá 10 minutos.');
  if (String(pin || '') !== real) {
    cache.put('login-fallos', String(fallos + 1), 600);
    throw new Error('PIN incorrecto.');
  }
  const exp = Date.now() + TOKEN_HORAS * 3600 * 1000;
  return { token: exp + '.' + firma(String(exp)), exp };
}

function firma(s) {
  const secreto = prop('TOKEN_SECRET');
  if (!secreto) throw new Error('Falta TOKEN_SECRET. Corré «Instalar / reparar».');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secreto)).replace(/=+$/, '');
}

function verificarToken(token) {
  const [exp, f] = String(token || '').split('.');
  if (!exp || !f || f !== firma(exp)) throw new Error('Sesión inválida. Volvé a ingresar el PIN.');
  if (Number(exp) < Date.now()) throw new Error('La sesión venció. Volvé a ingresar el PIN.');
}

// ---------- Catálogo: borrador y publicación ----------
function todo() {
  return {
    productos: leer('productos'), variantes: leer('variantes'), config: leerConfig('config'),
    productos_draft: leer('productos_draft'), variantes_draft: leer('variantes_draft'), config_draft: leerConfig('config_draft'),
    pedidos: leer('pedidos').map((p) => Object.assign(p, { items: json(p.items, []) })),
    clientes: leer('clientes'),
  };
}

function json(v, def) { try { return v ? JSON.parse(v) : def; } catch (e) { return def; } }

function guardarBorrador(b) {
  const productos = b.productos || leer('productos_draft');
  const variantes = b.variantes || leer('variantes_draft');
  validarCatalogo(productos, variantes);
  if (b.productos) escribir('productos_draft', productos);
  if (b.variantes) escribir('variantes_draft', variantes);
  if (b.config) escribirConfig('config_draft', Object.assign(leerConfig('config_draft'), b.config));
  return { cambios: contarCambios() };
}

function validarCatalogo(productos, variantes) {
  const err = [];
  const slugs = new Set();
  productos.forEach((p, i) => {
    const s = String(p.slug || '');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) err.push(`Fila ${i + 2}: el slug «${s}» solo puede tener minúsculas, números y guiones.`);
    if (slugs.has(s)) err.push(`El slug «${s}» está repetido.`);
    slugs.add(s);
    if (!String(p.nombre || '').trim()) err.push(`«${s}»: falta el nombre.`);
    if (!CATEGORIAS.includes(String(p.categoria || '').toUpperCase())) err.push(`«${s}»: la categoría tiene que ser ${CATEGORIAS.join(', ')}.`);
    if (p.precio !== '' && !(Number(p.precio) >= 0)) err.push(`«${s}»: el precio no es un número.`);
  });
  variantes.forEach((v) => {
    if (!slugs.has(String(v.slug))) err.push(`Hay una variante de «${v.slug}», que no existe en productos.`);
    if (v.precio !== '' && v.precio != null && !(Number(v.precio) >= 0)) err.push(`«${v.slug} / ${v.nombre}»: el precio no es un número.`);
    const pt = typeof v.precios_talle === 'object' ? v.precios_talle : v.precios_talle ? json(v.precios_talle, null) : {};
    if (!pt || typeof pt !== 'object' || Array.isArray(pt)) err.push(`«${v.slug} / ${v.nombre}»: precios_talle tiene que ser JSON, ej. {"4XL":55000}.`);
  });
  slugs.forEach((s) => { if (!variantes.some((v) => String(v.slug) === s)) err.push(`«${s}» no tiene ninguna variante (color).`); });
  if (err.length) throw new Error(err.slice(0, 8).join('\n'));
}

/** Cantidad de filas distintas entre borrador y publicado (para el aviso de cambios sin publicar). */
function contarCambios() {
  const clave = (r) => JSON.stringify(r);
  const dif = (a, b, id) => {
    const filas = (n) => leer(n).filter((r) => r.clave !== 'ultima_publicacion');
    const A = new Map(filas(a).map((r) => [id(r), clave(r)]));
    const B = new Map(filas(b).map((r) => [id(r), clave(r)]));
    let n = 0;
    new Set([...A.keys(), ...B.keys()]).forEach((k) => { if (A.get(k) !== B.get(k)) n++; });
    return n;
  };
  return dif('productos_draft', 'productos', (r) => r.slug)
    + dif('variantes_draft', 'variantes', (r) => r.slug + '|' + r.idx)
    + dif('config_draft', 'config', (r) => r.clave);
}

function publicar() {
  const productos = leer('productos_draft');
  const variantes = leer('variantes_draft');
  validarCatalogo(productos, variantes);
  const antes = new Map(leer('productos').map((p) => [p.slug, JSON.stringify(p)]));
  const hoy = ahora().slice(0, 10);
  const vAntes = leer('variantes');
  // `actualizado` = fecha del último cambio de cada producto (se ve en la ficha).
  productos.forEach((p) => {
    const vs = JSON.stringify(variantes.filter((v) => v.slug === p.slug));
    const vsAntes = JSON.stringify(vAntes.filter((v) => v.slug === p.slug));
    const sinFecha = (o) => JSON.stringify(Object.assign({}, o, { actualizado: '' }));
    const prev = antes.get(p.slug);
    if (!prev || sinFecha(JSON.parse(prev)) !== sinFecha(p) || vs !== vsAntes) p.actualizado = hoy;
  });
  const cambiados = productos.filter((p) => p.actualizado === hoy).map((p) => p.slug);
  escribir('productos_draft', productos);
  escribir('productos', productos);
  escribir('variantes', variantes);
  const cfg = Object.assign(leerConfig('config_draft'), { ultima_publicacion: ahora() });
  escribirConfig('config', cfg);
  escribirConfig('config_draft', cfg);
  CacheService.getScriptCache().remove('catalog');
  const build = pedirBuild();
  encolarIndexNow(cambiados);
  return { ultima_publicacion: cfg.ultima_publicacion, build };
}

function descartarBorrador() {
  escribir('productos_draft', leer('productos'));
  escribir('variantes_draft', leer('variantes'));
  escribirConfig('config_draft', leerConfig('config'));
  return { cambios: 0 };
}

/** Dispara el build de Netlify. Si hubo uno hace menos de 2 min, lo agenda para el final de esa ventana. */
function pedirBuild() {
  const props = PropertiesService.getScriptProperties();
  if (!prop('DEPLOY_HOOK_URL')) return 'sin DEPLOY_HOOK_URL';
  const ultimo = Number(props.getProperty('ultimo_build') || 0);
  const falta = ultimo + BUILD_MIN_ENTRE - Date.now();
  if (falta <= 0) return dispararBuild();
  if (props.getProperty('build_agendado')) return 'agendado';
  props.setProperty('build_agendado', '1');
  ScriptApp.newTrigger('dispararBuild').timeBased().after(Math.max(falta, 60000)).create();
  return 'agendado';
}

function dispararBuild() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('build_agendado');
  borrarTriggers('dispararBuild');
  props.setProperty('ultimo_build', String(Date.now()));
  const r = UrlFetchApp.fetch(prop('DEPLOY_HOOK_URL'), { method: 'post', muteHttpExceptions: true });
  return r.getResponseCode() < 300 ? 'enviado' : 'error ' + r.getResponseCode();
}

/** IndexNow (Bing y otros): avisa las fichas cambiadas unos minutos después del build. Requiere SITE_URL. */
function encolarIndexNow(slugs) {
  if (!prop('SITE_URL') || !slugs.length) return;
  const props = PropertiesService.getScriptProperties();
  const pend = new Set(json(props.getProperty('indexnow_pendientes'), []).concat(slugs));
  props.setProperty('indexnow_pendientes', JSON.stringify([...pend]));
  borrarTriggers('avisarIndexNow');
  ScriptApp.newTrigger('avisarIndexNow').timeBased().after(6 * 60 * 1000).create();
}

function avisarIndexNow() {
  borrarTriggers('avisarIndexNow');
  const props = PropertiesService.getScriptProperties();
  const site = String(prop('SITE_URL')).replace(/\/$/, '');
  const slugs = json(props.getProperty('indexnow_pendientes'), []);
  props.deleteProperty('indexnow_pendientes');
  if (!slugs.length) return;
  const urls = slugs.map((s) => `${site}/productos/${s}/`).concat([`${site}/`, `${site}/mayoristas/`]);
  UrlFetchApp.fetch('https://api.indexnow.org/indexnow', {
    method: 'post', contentType: 'application/json; charset=utf-8', muteHttpExceptions: true,
    payload: JSON.stringify({ host: site.replace(/^https?:\/\//, ''), key: INDEXNOW_KEY, keyLocation: `${site}/${INDEXNOW_KEY}.txt`, urlList: urls }),
  });
}

function borrarTriggers(fn) {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === fn).forEach((t) => ScriptApp.deleteTrigger(t));
}

// ---------- Pedidos ----------
const digitos = (t) => String(t || '').replace(/\D/g, '');
const tel10 = (t) => digitos(t).slice(-10);

function nuevoCodigo() {
  const d = new Date();
  const pre = 'TC-' + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + '-';
  const usados = new Set(leer('pedidos').map((p) => p.codigo));
  for (let i = 0; i < 50; i++) {
    let c = pre;
    for (let j = 0; j < 4; j++) c += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
    if (!usados.has(c)) return c;
  }
  throw new Error('No se pudo generar un código único.');
}

function crearPedido(b) {
  const cli = b.cliente || {};
  const nombre = String(cli.nombre || b.nombre || '').trim();
  const telefono = String(cli.telefono || b.telefono || '').trim();
  const items = (b.items || []).filter((x) => x && x.n && Number(x.qty) > 0);
  if (!nombre) throw new Error('Falta el nombre.');
  if (digitos(telefono).length < 8) throw new Error('El WhatsApp tiene que tener al menos 8 dígitos.');
  if (!items.length) throw new Error('Agregá al menos un producto.');
  const tipo = String(b.tipo || cli.tipo || 'MINORISTA').toUpperCase() === 'MAYORISTA' ? 'MAYORISTA' : 'MINORISTA';
  // El cliente se identifica por los últimos 10 dígitos del teléfono; si es nuevo se crea.
  let cliente = leer('clientes').find((c) => tel10(c.telefono) === tel10(telefono));
  if (!cliente) cliente = crearCliente({ nombre, telefono, localidad: b.destino || cli.localidad || '', tipo });
  const pedido = {
    codigo: nuevoCodigo(), fecha_alta: ahora(), cliente_id: cliente.id, nombre, telefono,
    items: items.map((x) => ({ n: String(x.n), sku: String(x.sku || ''), qty: Number(x.qty), price: Number(x.price) || 0 })),
    destino: String(b.destino || ''), entrega: String(b.entrega || 'DOMICILIO').toUpperCase(), tipo, estado: 0,
    f_confirmado: ahora(), transporte: '', guia: '', nota: String(b.nota || ''),
  };
  pedido.total_ref = pedido.items.reduce((a, x) => a + x.qty * x.price, 0);
  agregar('pedidos', pedido);
  return { pedido, cliente };
}

function pedido(code) {
  const p = leer('pedidos').find((x) => x.codigo === String(code || '').trim().toUpperCase());
  if (!p) throw new Error('No existe el pedido ' + code + '.');
  return p;
}

function guardarPedido(code, cambios) {
  CacheService.getScriptCache().remove('trk:' + code);
  const o = actualizar('pedidos', 'codigo', code, cambios);
  o.items = json(o.items, []);
  return o;
}

function validarTransporte(transporte, guia) {
  const t = String(transporte || '').trim().toUpperCase();
  if (!TRANSPORTES.includes(t)) throw new Error('Elegí el transporte.');
  if (!LOCALES.includes(t) && !String(guia || '').trim()) throw new Error('Falta el número de guía.');
  return { transporte: t, guia: LOCALES.includes(t) ? '' : String(guia).trim() };
}

function avanzarPedido(code, transporte, guia) {
  const p = pedido(code);
  const st = Number(p.estado) || 0;
  if (st >= 3) throw new Error('El pedido ya está entregado.');
  const cambios = { estado: st + 1 };
  cambios[FECHAS_PASO[st + 1]] = ahora();
  if (st + 1 === 2) Object.assign(cambios, validarTransporte(transporte || p.transporte, guia || p.guia));
  return guardarPedido(p.codigo, cambios);
}

function deshacerPaso(code) {
  const p = pedido(code);
  const st = Number(p.estado) || 0;
  if (st <= 0) throw new Error('El pedido está en el primer paso.');
  const cambios = { estado: st - 1 };
  cambios[FECHAS_PASO[st]] = '';
  cambios['avisado_' + st] = false;
  return guardarPedido(p.codigo, cambios);
}

function cargarGuia(code, transporte, guia) {
  const p = pedido(code);
  return guardarPedido(p.codigo, validarTransporte(transporte, guia));
}

function marcarAvisado(code, stage) {
  const p = pedido(code);
  const s = Number(stage);
  if (!(s >= 0 && s <= 3)) throw new Error('Paso inválido.');
  const cambios = {};
  cambios['avisado_' + s] = true;
  return guardarPedido(p.codigo, cambios);
}

// ---------- Clientes ----------
function limpiarCliente(c) {
  const tipo = String(c.tipo || 'MINORISTA').toUpperCase() === 'MAYORISTA' ? 'MAYORISTA' : 'MINORISTA';
  return {
    nombre: String(c.nombre || '').trim(), telefono: String(c.telefono || '').trim(), localidad: String(c.localidad || '').trim(),
    tipo, cuit: tipo === 'MAYORISTA' ? String(c.cuit || '').trim() : '', nota: String(c.nota || ''),
  };
}

function crearCliente(c) {
  const d = limpiarCliente(c || {});
  if (!d.nombre) throw new Error('Falta el nombre.');
  if (digitos(d.telefono).length < 8) throw new Error('El WhatsApp tiene que tener al menos 8 dígitos.');
  const todos = leer('clientes');
  const existe = todos.find((x) => tel10(x.telefono) === tel10(d.telefono));
  if (existe) throw new Error(`Ya existe un cliente con ese WhatsApp (${existe.nombre}).`);
  const n = todos.reduce((m, x) => Math.max(m, Number(String(x.id).replace(/\D/g, '')) || 0), 0) + 1;
  return agregar('clientes', Object.assign({ id: 'c' + n, alta: ahora() }, d));
}

function guardarCliente(c) {
  if (!c || !c.id) return crearCliente(c);
  const d = limpiarCliente(c);
  const otro = leer('clientes').find((x) => x.id !== c.id && tel10(x.telefono) === tel10(d.telefono));
  if (otro) throw new Error(`Ese WhatsApp ya es de ${otro.nombre}.`);
  return actualizar('clientes', 'id', c.id, d);
}

// ---------- Fotos ----------
function carpeta(ruta) {
  let c = null;
  const it = DriveApp.getFoldersByName(CARPETA);
  c = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
  ruta.forEach((n) => { const s = c.getFoldersByName(n); c = s.hasNext() ? s.next() : c.createFolder(n); });
  return c;
}

/** El panel comprime a WebP (≤1600 px) y manda base64. Devuelve el fileId para la columna `fotos`. */
function subirFoto(b) {
  const slug = String(b.slug || '');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error('Producto inválido.');
  const datos = String(b.base64 || '').replace(/^data:[^,]+,/, '');
  if (!datos || datos.length > 8 * 1024 * 1024) throw new Error('La foto está vacía o pesa más de 6 MB.');
  const mime = /^image\/(webp|jpeg|png)$/.test(b.mime) ? b.mime : 'image/webp';
  const nombre = `${slug}-${Number(b.idx) || 0}-${Date.now()}.${mime.split('/')[1].replace('jpeg', 'jpg')}`;
  const f = carpeta(['fotos', slug]).createFile(Utilities.newBlob(Utilities.base64Decode(datos), mime, nombre));
  return { fileId: f.getId(), nombre };
}

// ---------- Menú dentro de la planilla ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Tactical Command')
    .addItem('Publicar en la web', 'menuPublicar')
    .addItem('Descartar borrador', 'menuDescartar')
    .addSeparator()
    .addItem('Configurar PIN del panel', 'menuPin')
    .addItem('Configurar Build Hook de Netlify', 'menuHook')
    .addItem('Instalar / reparar', 'instalar')
    .addToUi();
}

function menuPublicar() {
  const ui = SpreadsheetApp.getUi();
  const n = contarCambios();
  if (!n) { ui.alert('No hay cambios en las hojas *_draft: la web ya está al día.'); return; }
  if (ui.alert('Publicar en la web', `Hay ${n} fila(s) con cambios en el borrador. La web se actualiza en 1 o 2 minutos. ¿Publicar?`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  try {
    const r = conLock(() => publicar());
    ui.alert(r.build === 'sin DEPLOY_HOOK_URL' ? 'Publicado en la planilla, pero falta configurar el Build Hook: la web no se va a actualizar.' : 'Listo. La web se actualiza en 1 o 2 minutos.');
  } catch (e) { ui.alert('No se pudo publicar:\n\n' + e.message); }
}

function menuDescartar() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Descartar borrador', 'Las hojas *_draft vuelven a quedar iguales a lo publicado. ¿Seguro?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  conLock(() => descartarBorrador());
  ui.alert('Borrador descartado.');
}

function menuPin() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('PIN del panel', 'Mínimo 6 números. Es la clave con la que Walter entra al panel.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const pin = r.getResponseText().trim();
  if (!/^\d{6,12}$/.test(pin)) { ui.alert('El PIN tiene que tener entre 6 y 12 números.'); return; }
  PropertiesService.getScriptProperties().setProperty('PIN', pin);
  ui.alert('PIN guardado.');
}

function menuHook() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Build Hook de Netlify', 'Pegá la URL (Netlify › Site configuration › Build & deploy › Build hooks).', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const url = r.getResponseText().trim();
  if (!/^https:\/\/api\.netlify\.com\/build_hooks\/\w+$/.test(url)) { ui.alert('Esa URL no parece un Build Hook de Netlify (https://api.netlify.com/build_hooks/…).'); return; }
  PropertiesService.getScriptProperties().setProperty('DEPLOY_HOOK_URL', url);
  ui.alert('Build Hook guardado.');
}

// ---------- Instalación y backups ----------
/** Crea las hojas que falten, carga la semilla si están vacías, da formato y crea los triggers. Se puede correr de nuevo. */
function instalar() {
  const ss = libro();
  Object.keys(hojas()).forEach((nombre) => {
    let h = ss.getSheetByName(nombre);
    if (!h) h = ss.insertSheet(nombre);
    const cols = hojas()[nombre];
    h.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#151816').setFontColor('#E3B23C');
    h.setFrozenRows(1);
    // Texto plano en todo salvo números y casillas: así teléfonos, talles, SKU y fechas no se reformatean.
    cols.forEach((c, i) => {
      if (BOOLEANAS.includes(c)) return;
      h.getRange(2, i + 1, Math.max(h.getMaxRows() - 1, 1), 1).setNumberFormat(NUMERICAS.includes(c) ? '0' : '@');
    });
  });
  const vacia = (n) => hoja(n).getLastRow() < 2;
  ['productos', 'productos_draft'].forEach((n) => { if (vacia(n)) escribir(n, SEMILLA.productos); });
  ['variantes', 'variantes_draft'].forEach((n) => { if (vacia(n)) escribir(n, SEMILLA.variantes); });
  ['config', 'config_draft'].forEach((n) => { if (vacia(n)) escribirConfig(n, SEMILLA.config); });
  // Las hojas publicadas no se editan a mano: se reemplazan al publicar.
  ['productos', 'variantes', 'config'].forEach((n) => {
    const h = hoja(n);
    h.setTabColor('#4A5D4B');
    h.getRange('A1').setNote('No editar: esta hoja se reemplaza al publicar. Los cambios van en ' + n + '_draft y se publican desde el menú Tactical Command.');
    if (!h.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) h.protect().setDescription('Se reemplaza al publicar').setWarningOnly(true);
  });
  ['productos_draft', 'variantes_draft', 'config_draft'].forEach((n) => hoja(n).setTabColor('#E3B23C'));
  const hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && hoja1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(hoja1);

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN_SECRET')) props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  borrarTriggers('backupSemanal');
  ScriptApp.newTrigger('backupSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(4).create();
  carpeta(['fotos']);
  carpeta(['backups']);

  const falta = ['PIN', 'DEPLOY_HOOK_URL'].filter((k) => !props.getProperty(k));
  const msg = 'Instalación lista.' + (falta.length ? ' Falta configurar: ' + falta.join(' y ') + ' (menú Tactical Command).' : '');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/** Copia semanal de la planilla en TC/backups/AAAA-MM-DD; conserva las últimas 12. */
function backupSemanal() {
  const dir = carpeta(['backups']);
  const nombre = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  DriveApp.getFileById(libro().getId()).makeCopy(nombre, dir);
  const copias = [];
  const it = dir.getFiles();
  while (it.hasNext()) copias.push(it.next());
  copias.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(12).forEach((f) => f.setTrashed(true));
}
