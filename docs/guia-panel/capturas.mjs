// Capturas del panel (contra el simulador) para la guía de Walter.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('/home/user/tacticalcommand/node_modules/sharp');
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const API = 'http://localhost:8790';
const post = async (b) => (await (await fetch(API, { method: 'POST', body: JSON.stringify(b) })).json());

// Datos de ejemplo: clientes y pedidos en distintos pasos.
const { data: { token } } = await post({ action: 'login', pin: '123456' });
const P = (action, b = {}) => post({ action, token, ...b });
const it = (n, sku, qty = 1) => ({ n, sku, qty, price: 50000 });
const crear = async (nombre, telefono, destino, items, extra = {}) => (await P('createOrder', { cliente: { nombre, telefono, localidad: destino, tipo: extra.tipo || 'MINORISTA' }, destino, entrega: extra.entrega || 'DOMICILIO', tipo: extra.tipo || 'MINORISTA', items, nota: extra.nota || '' })).data.pedido.codigo;
const a = await crear('Martín Gómez', '3492 556677', 'Córdoba Capital', [it('Campera Gore-Tex · Negro · Talle L', 'TC-GTEX-001-NG'), it('Cinto Táctico · Negro', 'TC-CIN-COB-NG')], { entrega: 'SUCURSAL' });
const b2 = await crear('Armería Sur', '11 4444 5555', 'Bahía Blanca', [it('Bajo Chaleco Manga Larga Negro · Talle M', 'TC-CHA', 6), it('Bajo Chaleco Manga Larga Negro · Talle L', 'TC-CHA', 6)], { tipo: 'MAYORISTA', entrega: 'SUCURSAL' });
const c = await crear('Lucía Fernández', '3492 401122', 'Rafaela', [it('Sombrero de Monte · Woodland · Talle M', 'TC-SOM')]);
const d = await crear('Diego Ríos', '341 600 1234', 'Rosario', [it('Borcego Táctico Ranger Negro · Nro 42', 'TC-BOR-RNG-NG')]);
for (const [code, pasos, transporte, guia] of [[a, 1, '', ''], [b2, 2, 'ANDREANI', '360002148795'], [c, 3, 'RETIRO EN RAFAELA', '']]) {
  for (let i = 0; i < pasos; i++) {
    await P('markNotified', { code, stage: i });
    await P('advanceOrder', { code, transporte, guia });
  }
}
await P('markNotified', { code: c, stage: 3 });

const b = await chromium.launch({ args: ['--host-resolver-rules=MAP tacticalcommand.com.ar 127.0.0.1', '--no-proxy-server'] });
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const toast = async () => { await pg.waitForSelector('.toast', { timeout: 15000 }).catch(() => {}); await pg.waitForSelector('.toast', { state: 'detached', timeout: 6000 }).catch(() => {}); };
const foto = async (n, opts = {}) => { await pg.waitForTimeout(400); await pg.screenshot({ path: `${OUT}/${n}.png`, ...opts }); };
const arriba = () => pg.evaluate(() => scrollTo(0, 0));
const ver = (sel, block = 'center') => pg.evaluate(([s, bl]) => document.querySelector(s)?.scrollIntoView({ block: bl }), [sel, block]);
const nav = (t) => pg.click(`.nav-i:has-text("${t}")`);

await pg.goto('http://tacticalcommand.com.ar/panel/', { waitUntil: 'networkidle' });
await pg.fill('.pin', '123456'); await foto('login');
await pg.click('button[type=submit]'); await pg.waitForSelector('.fila');
await foto('pedidos');

// Nuevo pedido
await pg.click('text=+ Nuevo pedido');
await pg.fill('label:has-text("Nombre") input', 'Mart');
await foto('nuevo-1');
await pg.fill('label:has-text("Nombre") input', 'Pablo Acosta'); await pg.fill('label:has-text("WhatsApp") input', '3492 512233');
await pg.fill('label:has-text("Localidad") input', 'Santa Fe');
await pg.selectOption('label:has-text("Producto") select', 'pantalon-cargo-tactico-ripstop-negro');
await pg.selectOption('label:has-text("Talle") select', 'L'); await pg.click('text=+ Sumar al pedido');
await ver('.tarjeta:nth-of-type(2)', 'start'); await pg.evaluate(() => scrollBy(0, -80)); await foto('nuevo-2');
await pg.click('text=Guardar pedido'); await toast(); await pg.waitForSelector('.pasos');
await arriba(); await foto('detalle-nuevo');
await ver('.tarjeta-wa'); await foto('detalle-avisar');
await pg.click('text=Ya le avisé de otra forma'); await toast();

// Despacho con transporte (pedido en preparación)
await pg.click('text=‹ Volver'); await pg.click(`.fila:has-text("${a}")`); await pg.waitForSelector('.pasos');
await pg.click('text=Ya le avisé de otra forma'); await toast();
await pg.selectOption('label:has-text("Transporte") select', 'CORREO ARGENTINO'); await pg.fill('label:has-text("Número de guía") input', 'TN123456789AR');
await pg.locator('label:has-text("Número de guía")').scrollIntoViewIfNeeded(); await pg.evaluate(() => scrollBy(0, 160)); await foto('despacho');
await pg.click('button:has-text("Pasar a")'); await pg.waitForSelector('.modal'); await foto('confirmar');
await pg.click('.modal .b-pri'); await toast(); await ver('.tarjeta-wa'); await foto('aviso-despacho');
await pg.click('text=‹ Volver');
await pg.click(`.fila:has-text("${c}")`); await pg.waitForSelector('.pasos'); await arriba(); await foto('retiro');
await pg.click('text=‹ Volver');

// Clientes
await nav('Clientes'); await pg.waitForSelector('.fila'); await foto('clientes');
await pg.click('.fila:has-text("Armería Sur")'); await pg.waitForSelector('.stats'); await foto('cliente');

// Productos
await nav('Productos'); await pg.waitForSelector('.fila-prod'); await foto('productos');
await pg.click('.fila-prod:has-text("Borcego Táctico Ranger")'); await pg.waitForSelector('.calidad'); await foto('editor-arriba');
await ver('.calidad', 'start'); await pg.evaluate(() => scrollBy(0, -70)); await foto('editor-calidad');
await ver('.color.abierto', 'start'); await pg.evaluate(() => scrollBy(0, -70)); await foto('editor-colores');
await pg.evaluate(() => [...document.querySelectorAll('.tarjeta h2')].find((h) => h.textContent.includes('La ficha'))?.scrollIntoView({ block: 'start' })); await pg.evaluate(() => scrollBy(0, -70)); await foto('editor-ficha');
await pg.evaluate(() => [...document.querySelectorAll('.campo-l')].find((h) => h.textContent.includes('Preguntas'))?.scrollIntoView({ block: 'start' })); await pg.evaluate(() => scrollBy(0, -70)); await foto('editor-faq');
// Subir una foto y guardar
const img = await sharp({ create: { width: 1400, height: 1400, channels: 3, background: '#2b2b2b' } }).jpeg().toBuffer();
await pg.setInputFiles('.foto-mas input', { name: 'nueva.jpg', mimeType: 'image/jpeg', buffer: img }); await toast();
await pg.click('text=Guardar cambios'); await toast(); await pg.waitForSelector('.barra-bor');
await pg.evaluate(() => scrollTo(0, document.body.scrollHeight)); await foto('otras-acciones');
await pg.click('text=‹ Volver'); await pg.click('text=+ Nuevo producto'); await pg.waitForSelector('.calidad'); await foto('producto-nuevo');
await pg.click('text=‹ Volver').catch(() => {});

// Precios
await nav('Precios'); await pg.waitForSelector('.precio-f');
await pg.locator('.precio-in input').first().fill('54.000'); await foto('precios');
await pg.click('.precio-f:has-text("Campera") >> text=Colores y talles'); await ver('.precio-v', 'start'); await pg.evaluate(() => scrollBy(0, -140)); await foto('precios-talles');
await pg.click('text=% Ajuste masivo'); await pg.waitForSelector('.modal'); await pg.selectOption('.modal select >> nth=0', 'CALZADO'); await foto('ajuste');
await pg.click('.modal button:has-text("Cancelar")');
await pg.click('text=Guardar precios'); await toast();

// Publicar
await pg.click('text=Revisar y publicar'); await pg.waitForSelector('.rev'); await foto('revisar');
await pg.click('.modal button:has-text("Volver")');

// Más
await nav('Más'); await foto('mas');
await pg.click('text=Resumen del negocio'); await foto('resumen'); await pg.click('text=‹ Volver');
await pg.click('text=Mayoristas'); await foto('mayoristas'); await pg.click('text=‹ Volver');
await pg.click('text=Destacados de la home'); await foto('destacados'); await pg.click('text=‹ Volver');
await pg.click('text=Aviso en la web'); await pg.click('.interruptor'); await pg.fill('label:has-text("Texto") input', 'Del 24 al 31 de diciembre no hacemos envíos'); await foto('aviso'); await pg.click('text=‹ Volver');
await pg.click('text=Fotos de clientes'); await foto('resenas'); await pg.click('text=‹ Volver');
await pg.click('text=Cambiar el PIN'); await foto('pin');

// Computadora
await pg.setViewportSize({ width: 1280, height: 800 }); await nav('Pedidos'); await pg.waitForSelector('.fila');
await foto('computadora');
await b.close();
console.log('capturas listas');
