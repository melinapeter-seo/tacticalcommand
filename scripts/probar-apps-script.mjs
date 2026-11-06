// Prueba la API del Apps Script contra el simulador (sin Google): instalación, catálogo, borrador y publicación,
// login, pedidos, seguimiento, clientes y fotos.   node scripts/probar-apps-script.mjs
import assert from 'node:assert/strict';
import vm from 'node:vm';
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
const semilla = vm.runInContext('({ p: SEMILLA.productos.length, v: SEMILLA.variantes.length })', ctx);
assert.ok(semilla.p > 0);
assert.equal(cat.productos.length, semilla.p);
assert.equal(cat.variantes.length, semilla.v);
assert.equal(Number(cat.config.ws_minimo), 8);
assert.equal(cat.productos[0].visible, true);
assert.ok(estado.props.TOKEN_SECRET);

// Login
falla(post({ action: 'login', pin: '1' }), /no está configurado/, 'sin PIN');
estado.props.PIN = '246810';
falla(post({ action: 'login', pin: '000000' }), /incorrecto/, 'PIN malo');
let { token } = ok(post({ action: 'login', pin: '246810' }), 'login');
falla(post({ action: 'getAll', token: 'x.y' }), /Sesión inválida/, 'token falso');
falla(post({ action: 'getAll', token: '1.' + token.split('.')[1] }), /Sesión inválida/, 'token con otro vencimiento');
const P = (action, b = {}) => post({ action, token, ...b }); // usa el token vigente

// Borrador y publicación
const todo = ok(P('getAll'), 'getAll');
const pd = todo.productos_draft, vd = todo.variantes_draft;
pd.find((p) => p.slug === 'shemagh').precio = 42000;
pd.find((p) => p.slug === 'shemagh').precio_mayorista = 30000;
vd.find((v) => v.slug === 'campera-gtex-outdoor' && v.nombre === 'AZUL NOCHE').precios_talle = '{"3XL":70000}';
vd.find((v) => v.slug === 'campera-gtex-outdoor' && v.nombre === 'AZUL NOCHE').precios_talle_mayorista = '{"3XL":52000}';
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
// Precios mayoristas: los guarda el panel y llegan a la web (página de mayoristas).
assert.equal(Number(she.precio_mayorista), 30000); n++;
assert.equal(cat2.variantes.find((v) => v.slug === 'campera-gtex-outdoor' && v.nombre === 'AZUL NOCHE').precios_talle_mayorista, '{"3XL":52000}'); n++;
const todoM = ok(P('getAll'), 'getAll con mayoristas');
assert.equal(Number(todoM.productos.find((p) => p.slug === 'shemagh').precio_mayorista), 30000);
assert.equal(todoM.variantes.find((v) => v.slug === 'campera-gtex-outdoor' && v.nombre === 'AZUL NOCHE').precios_talle_mayorista, '{"3XL":52000}');
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

// Fichas: guardar un producto, historial al publicar y volver a la versión anterior
let all0 = ok(P('getAll'), 'getAll fichas');
assert.equal(all0.fichas_draft.length, semilla.p, 'una ficha por producto');
const prodS = all0.productos_draft.find((x) => x.slug === 'shemagh');
const varS = all0.variantes_draft.filter((x) => x.slug === 'shemagh');
const fichaS = all0.fichas_draft.find((x) => x.slug === 'shemagh');
const cont = JSON.parse(fichaS.contenido);
cont.faq.push({ q: '¿Se puede lavar?', a: 'Sí, a mano.' });
let r = ok(P('saveProduct', { producto: { ...prodS, nombre: 'Shemagh Táctico Árabe' }, variantes: varS, ficha: { contenido: cont, pendiente: true, notas: 'armala vos' } }), 'saveProduct');
assert.ok(r.cambios >= 2);
let all1 = ok(P('getAll'), 'getAll tras saveProduct');
assert.equal(all1.productos_draft.findIndex((x) => x.slug === 'shemagh'), all0.productos_draft.findIndex((x) => x.slug === 'shemagh'), 'conserva la posición');
assert.equal(all1.fichas_draft.find((x) => x.slug === 'shemagh').pendiente, true);
falla(P('saveProduct', { producto: { ...prodS, slug: 'shemagh', nombre: '' }, variantes: varS, ficha: {} }), /falta el nombre/, 'producto sin nombre');
ok(P('publish'), 'publish ficha');
let cat3 = ok(get({ action: 'catalog' }), 'catalog con fichas');
assert.equal(JSON.parse(cat3.fichas.find((x) => x.slug === 'shemagh').contenido).faq.at(-1).q, '¿Se puede lavar?');
assert.ok(ok(P('getAll'), 'versiones').versiones['shemagh'].length >= 1, 'se guardó la versión anterior');
r = ok(P('restoreVersion', { slug: 'shemagh' }), 'restoreVersion');
let all2 = ok(P('getAll'), 'getAll tras restaurar');
assert.equal(all2.productos_draft.find((x) => x.slug === 'shemagh').nombre, prodS.nombre, 'vuelve el nombre anterior');
assert.ok(!JSON.parse(all2.fichas_draft.find((x) => x.slug === 'shemagh').contenido).faq.some((f) => f.q === '¿Se puede lavar?'), 'vuelve la ficha anterior');
falla(P('restoreVersion', { slug: 'parche-bordado-bandera-argentina' }), /no tiene una versión anterior/, 'sin versión');
ok(P('discardDraft'), 'descartar restauración');
// Producto nuevo con slug provisorio que se renombra, y borrado
const nuevoP = { slug: 'producto-nuevo', nombre: 'Rodilleras Tácticas', categoria: 'ACCESORIOS', subcategoria: 'PROTECCIÓN', sku: 'TC-ROD', descripcion: 'Rodilleras.', visible: false, precio: 35000, talles: '', talles_ninos: '', orden: 9999, actualizado: '' };
ok(P('saveProduct', { producto: nuevoP, variantes: [{ nombre: 'NEGRO', sku: 'TC-ROD-NG', swatch: '#111', fotos: '', precio: '', precios_talle: '', agotados: '', agotado: false, talles: '' }], ficha: { contenido: { faq: [] } } }), 'nuevo');
ok(P('saveProduct', { slugAnterior: 'producto-nuevo', producto: { ...nuevoP, slug: 'rodilleras-tacticas' }, variantes: [{ nombre: 'NEGRO', sku: 'TC-ROD-NG', swatch: '#111' }], ficha: { contenido: {} } }), 'renombrar');
let all3 = ok(P('getAll'), 'getAll nuevo');
assert.ok(all3.productos_draft.some((x) => x.slug === 'rodilleras-tacticas') && !all3.productos_draft.some((x) => x.slug === 'producto-nuevo'));
assert.equal(all3.variantes_draft.filter((x) => x.slug === 'rodilleras-tacticas').length, 1);
falla(P('saveProduct', { slugAnterior: 'rodilleras-tacticas', producto: { ...nuevoP, slug: 'shemagh' }, variantes: [{ nombre: 'N', sku: 'x' }], ficha: {} }), /repetido/, 'slug repetido al renombrar');
ok(P('deleteProduct', { slug: 'rodilleras-tacticas' }), 'borrar');
assert.ok(!ok(P('getAll'), 'getAll borrado').productos_draft.some((x) => x.slug === 'rodilleras-tacticas'));
// Config nueva: destacados, reseñas y aviso
const cfgN = ok(get({ action: 'catalog' }), 'catalog config').config;
assert.ok(JSON.parse(cfgN.destacados).length > 0 && JSON.parse(cfgN.resenas).length === 13);
// Cambiar el PIN: invalida las sesiones anteriores
falla(P('changePin', { actual: '000000', nuevo: '135790' }), /actual no es correcto/, 'PIN actual malo');
falla(P('changePin', { actual: '246810', nuevo: '12' }), /entre 6 y 12/, 'PIN nuevo corto');
const ses = ok(P('changePin', { actual: '246810', nuevo: '135790' }), 'changePin');
falla(P('getAll'), /Sesión inválida/, 'el token viejo ya no sirve');
const token2 = ses.token;
ok(post({ action: 'getAll', token: token2 }), 'token nuevo');
ok(post({ action: 'login', pin: '135790' }), 'login con PIN nuevo');
token = token2;

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
// Borrar un pedido
const { pedido: p3 } = ok(P('createOrder', { cliente: { nombre: 'Martín', telefono: '3492 556677' }, items: [{ n: 'Cinto', qty: 1, price: 1 }] }), 'pedido de prueba');
ok(get({ action: 'track', code: p3.codigo }), 'track antes de borrar');
ok(P('deleteOrder', { code: p3.codigo }), 'deleteOrder');
falla(get({ action: 'track', code: p3.codigo }), /No encontramos/, 'el seguimiento ya no lo encuentra');
falla(P('deleteOrder', { code: p3.codigo }), /No existe/, 'borrar dos veces');
assert.equal(ok(P('getAll'), 'getAll tras borrar').pedidos.length, 2);
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
assert.equal(estado.hojas.productos.getLastRow(), semilla.p + 1);
assert.equal(estado.hojas.pedidos.getLastRow(), 3);

// Migración: una planilla instalada antes (sin fichas ni claves nuevas de config) se completa al reinstalar
const sim2 = crearSimulador({ props: { PIN: '111111' } });
sim2.ctx.instalar();
delete sim2.estado.hojas.fichas; delete sim2.estado.hojas.fichas_draft;
vm.runInContext("escribirConfig('config', { ws_minimo: 9 })", sim2.ctx);
sim2.ctx.instalar();
const mig = vm.runInContext("({ f: leer('fichas').length, cfg: leerConfig('config') })", sim2.ctx);
assert.equal(mig.f, semilla.p, 'crea y carga las fichas');
assert.equal(Number(mig.cfg.ws_minimo), 9, 'no pisa lo que ya estaba');
assert.ok('destacados' in mig.cfg && 'aviso_activo' in mig.cfg, 'agrega las claves que faltaban');
n += 3;

// ---------- Usuarios y contraseñas ----------
const tokPin = ok(post({ action: 'login', pin: '135790' }), 'login con PIN antes de usuarios').token;
vm.runInContext("crearUsuario('Walter', 'Walter', 'temporal-1')", ctx);
falla(post({ action: 'login', pin: '135790' }), /incorrectos/, 'con usuarios, el PIN ya no entra');
falla(post({ action: 'getAll', token: tokPin }), /Sesión inválida/, 'con usuarios, la sesión de PIN deja de valer');
falla(post({ action: 'login', usuario: 'walter', clave: 'mala-clave' }), /incorrectos/, 'contraseña mala');
const lw = ok(post({ action: 'login', usuario: ' WALTER ', clave: 'temporal-1' }), 'login con usuario');
assert.equal(lw.cambiar, true, 'contraseña temporal: pide cambiarla'); assert.equal(lw.nombre, 'Walter'); n += 2;
ok(post({ action: 'getAll', token: lw.token }), 'getAll con usuario');
falla(post({ action: 'changePassword', token: lw.token, actual: 'temporal-1', nueva: 'corta' }), /8 caracteres/, 'contraseña corta');
falla(post({ action: 'changePassword', token: lw.token, actual: 'otra-cosa', nueva: 'nueva-clave-1' }), /actual no es correcta/, 'actual mala');
const lw2 = ok(post({ action: 'changePassword', token: lw.token, actual: 'temporal-1', nueva: 'nueva-clave-1' }), 'cambiar contraseña');
assert.equal(lw2.cambiar, false); n++;
falla(post({ action: 'getAll', token: lw.token }), /Sesión inválida/, 'la contraseña nueva cierra las sesiones anteriores');
ok(post({ action: 'getAll', token: lw2.token }), 'la sesión nueva sirve');
falla(post({ action: 'login', usuario: 'walter', clave: 'temporal-1' }), /incorrectos/, 'la temporal ya no entra');
ok(post({ action: 'login', usuario: 'walter', clave: 'nueva-clave-1' }), 'entra con la suya');
vm.runInContext("crearUsuario('melina', 'Melina', 'otra-temporal')", ctx);
falla(post({ action: 'login', usuario: 'melina', clave: 'nueva-clave-1' }), /incorrectos/, 'cada usuario tiene su contraseña');
const lm = ok(post({ action: 'login', usuario: 'melina', clave: 'otra-temporal' }), 'login melina');
falla(post({ action: 'changePin', token: lm.token, actual: '135790', nuevo: '111111' }), /usuarios y contraseñas/, 'sin cambio de PIN con usuarios');
assert.ok(!estado.props.USUARIOS.includes('nueva-clave-1') && !estado.props.USUARIOS.includes('otra-temporal'), 'no guarda contraseñas en texto'); n++;
for (let i = 0; i < 10; i++) post({ action: 'login', usuario: 'melina', clave: 'x' });
falla(post({ action: 'login', usuario: 'melina', clave: 'otra-temporal' }), /Demasiados intentos/, 'bloqueo tras 10 intentos');
ok(post({ action: 'login', usuario: 'walter', clave: 'nueva-clave-1' }), 'el bloqueo es por usuario');
vm.runInContext("quitarUsuario('melina'); quitarUsuario('walter')", ctx);
ok(post({ action: 'login', pin: '135790' }), 'sin usuarios vuelve el PIN');

console.log(`Apps Script: ${n} comprobaciones OK.`);
