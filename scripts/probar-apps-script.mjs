// Prueba la API del Apps Script contra el simulador (sin Google): instalación, catálogo, borrador y publicación,
// login, pedidos, seguimiento, clientes y fotos.   node scripts/probar-apps-script.mjs
import assert from 'node:assert/strict';
import { crearSimulador } from './simulador-apps-script.mjs';

const sim = crearSimulador({ props: { DEPLOY_HOOK_URL: 'https://api.netlify.com/build_hooks/x', SITE_URL: 'https://tacticalcommand.com.ar' } });
const { ctx, estado, get, post } = sim;
let n = 0;
const ok = (r, msg) => { assert.equal(r.ok, true, `${msg}: ${r.error}`); n++; return r.data; };
const falla = (r, re, msg) => { assert.equal(r.ok, false, msg); assert.match(r.error, re, msg); n++; };

// Instalación y semilla
ctx.instalar();
ctx.instalar(); // se puede correr dos veces sin duplicar
const cat = ok(get({ action: 'catalog' }), 'catalog');
assert.equal(cat.productos.length, 18);
assert.equal(cat.variantes.length, 37);
assert.equal(Number(cat.config.ws_minimo), 8);
assert.equal(cat.productos[0].visible, true);
assert.ok(estado.props.TOKEN_SECRET);

// Login
falla(post({ action: 'login', pin: '1' }), /no está configurado/, 'sin PIN');
estado.props.PIN = '246810';
falla(post({ action: 'login', pin: '000000' }), /incorrecto/, 'PIN malo');
const { token } = ok(post({ action: 'login', pin: '246810' }), 'login');
falla(post({ action: 'getAll', token: 'x.y' }), /Sesión inválida/, 'token falso');
falla(post({ action: 'getAll', token: '1.' + token.split('.')[1] }), /Sesión inválida/, 'token con otro vencimiento');
const P = (action, b = {}) => post({ action, token, ...b });

// Borrador y publicación
const todo = ok(P('getAll'), 'getAll');
const pd = todo.productos_draft, vd = todo.variantes_draft;
pd.find((p) => p.slug === 'shemagh').precio = 42000;
vd.find((v) => v.slug === 'campera-gtex-outdoor' && v.nombre === 'AZUL NOCHE').precios_talle = '{"3XL":70000}';
assert.equal(ok(P('saveDraft', { productos: pd, variantes: vd, config: { ws_minimo: 10 } }), 'saveDraft').cambios, 3);
assert.equal(Number(ok(get({ action: 'catalog' }), 'catalog').productos.find((p) => p.slug === 'shemagh').precio), 50000, 'lo publicado no cambia con el borrador');
falla(P('saveDraft', { productos: [...pd, { ...pd[0] }] }), /repetido/, 'slug repetido');
falla(P('saveDraft', { productos: [{ ...pd[0], slug: 'Con Espacios' }, ...pd.slice(1)] }), /slug/, 'slug inválido');
falla(P('saveDraft', { productos: [...pd, { slug: 'nuevo', nombre: 'Nuevo', categoria: 'ACCESORIOS', precio: 1 }] }), /no tiene ninguna variante/, 'producto sin variantes');
const pub = ok(P('publish'), 'publish');
assert.equal(pub.build, 'enviado');
assert.equal(estado.fetches.at(-1).url, 'https://api.netlify.com/build_hooks/x');
const cat2 = ok(get({ action: 'catalog' }), 'catalog tras publicar');
const she = cat2.productos.find((p) => p.slug === 'shemagh');
assert.equal(she.precio, 42000);
assert.equal(she.actualizado, new Date().toISOString().slice(0, 10));
assert.equal(Number(cat2.config.ws_minimo), 10);
assert.equal(ok(P('saveDraft', {}), 'sin cambios').cambios, 0);
// Segunda publicación enseguida: se agrupa en un build agendado
assert.equal(ok(P('publish'), 'publish 2').build, 'agendado');
assert.equal(ok(P('publish'), 'publish 3').build, 'agendado');
assert.equal(estado.triggers.filter((t) => t.fn === 'dispararBuild').length, 1);
sim.correrTriggers('dispararBuild');
assert.equal(estado.triggers.filter((t) => t.fn === 'dispararBuild').length, 0);
assert.equal(estado.fetches.filter((f) => f.url.includes('build_hooks')).length, 2);
// IndexNow agendado con la ficha cambiada
assert.ok(estado.triggers.some((t) => t.fn === 'avisarIndexNow'));
sim.correrTriggers('avisarIndexNow');
const inx = JSON.parse(estado.fetches.find((f) => f.url.includes('indexnow')).op.payload);
assert.ok(inx.urlList.includes('https://tacticalcommand.com.ar/productos/shemagh/'));
assert.equal(inx.key, '1812fd1788a18675031ad2819a2ffe64');
// Ocultar y descartar
const pd2 = ok(P('getAll'), 'getAll').productos_draft;
pd2.find((p) => p.slug === 'shemagh').visible = false;
ok(P('saveDraft', { productos: pd2 }), 'ocultar');
ok(P('discardDraft'), 'descartar');
assert.equal(ok(P('getAll'), 'getAll').productos_draft.find((p) => p.slug === 'shemagh').visible, true);

// Pedidos
falla(P('createOrder', { cliente: { nombre: 'Ana', telefono: '123' }, items: [{ n: 'x', qty: 1 }] }), /8 dígitos/, 'teléfono corto');
falla(P('createOrder', { cliente: { nombre: 'Ana', telefono: '3492 556677' }, items: [] }), /al menos un producto/, 'sin ítems');
const { pedido: p1, cliente: c1 } = ok(P('createOrder', { cliente: { nombre: 'Martín Gómez', telefono: '3492 556677' }, destino: 'Córdoba Capital', entrega: 'SUCURSAL', items: [{ n: 'Cinto Táctico Cobra · Negro', sku: 'TC-CIN-COB-NG', qty: 2, price: 50000 }] }), 'createOrder');
assert.match(p1.codigo, /^TC-\d{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
assert.equal(p1.total_ref, 100000);
assert.equal(c1.id, 'c1');
const { pedido: p2, cliente: c1b } = ok(P('createOrder', { cliente: { nombre: 'Martín', telefono: '+54 9 3492 55-6677' }, items: [{ n: 'Shemagh', qty: 1, price: 42000 }] }), 'mismo cliente');
assert.equal(c1b.id, 'c1', 'se reconoce por los últimos 10 dígitos');
let t = ok(get({ action: 'track', code: p1.codigo.toLowerCase() }), 'track');
assert.deepEqual(Object.keys(t).sort(), ['codigo', 'estado', 'fechas', 'guia', 'transporte']);
assert.equal(t.estado, 0);
assert.ok(t.fechas[0]);
falla(get({ action: 'track', code: 'TC-0000-AAAA' }), /No encontramos/, 'código inexistente');
falla(get({ action: 'track', code: 'cualquier cosa' }), /inválido/, 'código mal formado');
ok(P('advanceOrder', { code: p1.codigo }), 'a preparación');
falla(P('advanceOrder', { code: p1.codigo }), /transporte/, 'despacho sin transporte');
falla(P('advanceOrder', { code: p1.codigo, transporte: 'ANDREANI' }), /guía/, 'despacho sin guía');
let d = ok(P('advanceOrder', { code: p1.codigo, transporte: 'ANDREANI', guia: '360002' }), 'despachado');
assert.equal(d.estado, 2);
t = ok(get({ action: 'track', code: p1.codigo }), 'track despachado');
assert.equal(t.estado, 2, 'el caché del seguimiento se limpia al avanzar');
assert.equal(t.guia, '360002');
d = ok(P('undoStep', { code: p1.codigo }), 'deshacer');
assert.equal(d.estado, 1);
assert.equal(d.f_despacho, '');
ok(P('advanceOrder', { code: p2.codigo }), 'p2 preparación');
d = ok(P('advanceOrder', { code: p2.codigo, transporte: 'retiro en rafaela' }), 'retiro sin guía');
assert.equal(d.transporte, 'RETIRO EN RAFAELA');
assert.equal(d.guia, '');
ok(P('advanceOrder', { code: p2.codigo }), 'entregado');
falla(P('advanceOrder', { code: p2.codigo }), /entregado/, 'no pasa de entregado');
d = ok(P('markNotified', { code: p2.codigo, stage: 3 }), 'avisado');
assert.equal(d.avisado_3, true);
assert.equal(ok(P('setGuia', { code: p1.codigo, transporte: 'OCA', guia: 'AB1' }), 'setGuia').transporte, 'OCA');
const all = ok(P('getAll'), 'getAll');
assert.equal(all.pedidos.length, 2);
assert.equal(all.pedidos[0].items[0].qty, 2, 'ítems como objeto');

// Clientes
falla(P('createClient', { cliente: { nombre: 'Otro', telefono: '3492556677' } }), /Ya existe/, 'cliente duplicado');
const c2 = ok(P('createClient', { cliente: { nombre: 'Armería Sur', telefono: '11 4444 5555', tipo: 'mayorista', cuit: '30-1' } }), 'createClient');
assert.equal(c2.id, 'c2');
assert.equal(c2.tipo, 'MAYORISTA');
const c2b = ok(P('upsertClient', { cliente: { ...c2, localidad: 'Bahía Blanca', tipo: 'MINORISTA' } }), 'upsertClient');
assert.equal(c2b.localidad, 'Bahía Blanca');
assert.equal(c2b.cuit, '', 'el CUIT es solo para mayoristas');

// Fotos
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const { fileId } = ok(P('uploadPhoto', { slug: 'shemagh', idx: 0, base64: png, mime: 'image/png' }), 'uploadPhoto');
const f = ok(get({ action: 'photo', id: fileId }), 'photo');
assert.equal(f.base64, png);
falla(P('uploadPhoto', { slug: '../x', base64: png }), /inválido/, 'slug de foto inválido');
// Un archivo fuera de TC/fotos no se entrega
const ajeno = ctx.DriveApp.createFolder('Privado').createFile(ctx.Utilities.newBlob([1, 2, 3], 'image/png', 'x.png'));
falla(get({ action: 'photo', id: ajeno.getId() }), /TC\/fotos/, 'foto fuera de la carpeta');

// Backups: se conservan 12
for (let i = 0; i < 14; i++) ctx.backupSemanal();
const backups = ctx.DriveApp.getFoldersByName('TC').next().getFoldersByName('backups').next();
let nb = 0; for (const it = backups.getFiles(); it.hasNext(); it.next()) nb++;
assert.equal(nb, 12);

// Hojas: sin filas fantasma por las casillas
assert.equal(estado.hojas.productos.getLastRow(), 19);
assert.equal(estado.hojas.pedidos.getLastRow(), 3);

console.log(`Apps Script: ${n} comprobaciones OK.`);
