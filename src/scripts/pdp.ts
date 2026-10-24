// Ficha de producto: color, talle, galería, carrito, barra fija mobile y asistente de talles.
import { cart, money, waLink } from './cart';
import { track } from './track';

type Foto = { src: string; srcset: string; w: number; h: number; full: string; thumb: string };
type Col = { n: string; sku: string; sw: string; talles: string[]; fotos: Foto[]; precio: number; pt: Record<string, number> };
type Data = { slug: string; nombre: string; multi: boolean; app: boolean; conTalles: boolean; colores: Col[] };

const D: Data = JSON.parse(document.getElementById('pdp-data')!.textContent!);
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);
const $$ = <T extends HTMLElement = HTMLElement>(s: string) => Array.from(document.querySelectorAll<T>(s));
const w = window as any;
const isD = () => window.innerWidth >= 1024;
const pad = (n: number) => String(n).padStart(2, '0');

let col: Col = D.colores[0];
let talle: string | null = null;
let order: number[] = col.fotos.map((_, i) => i);

// Precio según color y talle (si el talle no está elegido y los precios varían, "DESDE" el menor).
const precio = () => (talle ? col.pt[talle] ?? col.precio : Math.min(col.precio, ...col.talles.map((t) => col.pt[t])));
const varia = () => !talle && new Set(col.talles.map((t) => col.pt[t])).size > 1;

track('view_item', { producto: D.nombre, sku: col.sku, valor: precio() });

// ---------- Galería ----------
const items = $('#gal-items')!;
const cap = (s: string) => s.toLowerCase().replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase());
function renderGal() {
  const fotos = order.map((i) => col.fotos[i]);
  if (!fotos.length) return;
  $('#gal')!.dataset.n = String(fotos.length);
  $('.pdp .hero')!.style.setProperty('--nT', String(Math.max(fotos.length - 1, 1)));
  items.innerHTML = '';
  fotos.forEach((f, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gi' + (i === 0 ? ' main' : '');
    b.dataset.i = String(i);
    b.setAttribute('aria-label', i === 0 ? `Ampliar foto de ${D.nombre}` : `Ver foto ${i + 1} de ${D.nombre}`);
    const im = document.createElement('img');
    im.src = f.src; im.srcset = f.srcset; im.width = f.w; im.height = f.h;
    im.sizes = i === 0 ? '(min-width: 1024px) 40vw, 100vw' : '(min-width: 1024px) 120px, 100vw';
    im.alt = `${D.nombre} ${D.multi ? cap(col.n) + ', ' : ''}vista ${i + 1}`;
    if (i > 0) im.loading = 'lazy';
    const wm = document.createElement('img');
    wm.src = '/escudo-tc-wm.webp'; wm.alt = ''; wm.className = 'wm'; wm.setAttribute('aria-hidden', 'true');
    b.append(im, wm);
    items.appendChild(b);
  });
  // los estilos con scope de Astro necesitan el atributo data-astro-cid del componente
  const cid = Array.from($('#gal')!.attributes).find((a) => a.name.startsWith('data-astro-cid'));
  if (cid) items.querySelectorAll('*').forEach((el) => el.setAttribute(cid.name, ''));
  const n = fotos.length;
  const gc = $('#gal-count'); if (gc) gc.textContent = `01 / ${pad(n)}`;
  const mc = $('#m-count'); if (mc) mc.textContent = `01 / ${pad(n)}`;
  const dots = $('#m-dots');
  if (dots) { dots.innerHTML = fotos.map((_, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join(''); if (cid) dots.querySelectorAll('span').forEach((s) => s.setAttribute(cid.name, '')); }
  items.scrollLeft = 0;
}
items.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('.gi');
  if (!b || b.classList.contains('ph')) return;
  const i = +b.dataset.i!;
  const fotos = order.map((k) => col.fotos[k]);
  if (isD() && i > 0) {
    const t = order[0]; order[0] = order[i]; order[i] = t;
    renderGal();
    return;
  }
  w.tcLightbox?.(fotos.map((f, k) => ({ src: f.full, alt: `${D.nombre} ${cap(col.n)} vista ${k + 1}` })), i);
});
items.addEventListener('scroll', () => {
  if (isD()) return;
  const first = items.querySelector<HTMLElement>('.gi');
  if (!first) return;
  const step = first.offsetWidth + (parseFloat(getComputedStyle(items).columnGap) || 0);
  const i = Math.round(items.scrollLeft / Math.max(1, step));
  const mc = $('#m-count'); if (mc) mc.textContent = `${pad(i + 1)} / ${pad(order.length)}`;
  $$('#m-dots span').forEach((s, k) => s.classList.toggle('on', k === i));
}, { passive: true });

// ---------- Color ----------
function waAsk() {
  return waLink(`Hola Walter! Quiero consultar por ${D.nombre}${D.multi || D.app ? `, color ${col.n.toLowerCase()}` : ''}${talle ? `, talle ${talle}` : ''} (SKU ${col.sku}). ¿Tienen disponibilidad y precio?`);
}
function syncTexts() {
  $$('[data-color-name]').forEach((e) => (e.textContent = col.n));
  $$('[data-sku]').forEach((e) => (e.textContent = col.sku));
  const a = $<HTMLAnchorElement>('#wa-ask');
  if (a) { a.href = waAsk(); a.dataset.track = JSON.stringify({ producto: D.nombre, sku: col.sku, color: col.n, talle: talle || '', qty: 1, tipo: 'minorista', valor: precio() }); }
  $$<HTMLDataElement>('[data-precio]').forEach((e) => { e.value = String(precio()); e.textContent = (varia() ? 'DESDE ' : '') + money(precio()); });
  const sp = $<HTMLAnchorElement>('#wa-spec');
  if (sp) sp.href = waLink(`Hola Tactical Command! Quiero consultar disponibilidad de ${D.nombre} en color ${col.n.toLowerCase()}${talle ? `, talle ${talle}` : ''}.`);
  const st = $('#sz-state');
  if (st) { st.textContent = talle ? `TALLE ${talle}` : 'SELECCIONAR TALLE'; st.classList.toggle('on', !!talle); }
  const ss = $('#st-s');
  if (ss) ss.textContent = col.n + (D.conTalles ? ' · ' + (talle ? 'TALLE ' + talle : 'SELECCIONAR TALLE') : '');
}
function pickColor(n: string, user = true) {
  const c = D.colores.find((x) => x.n === n);
  if (!c) return;
  col = c; order = c.fotos.map((_, i) => i);
  $$('.sw').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === n)));
  // Cada color tiene sus talles; si el talle elegido no existe en el nuevo color, se limpia.
  $$<HTMLButtonElement>('.sz').forEach((b) => (b.hidden = !c.talles.includes(b.dataset.talle!)));
  if (talle && !c.talles.includes(talle)) { talle = null; $$('.sz').forEach((b) => b.setAttribute('aria-checked', 'false')); }
  renderGal();
  syncTexts();
  if (user) {
    const u = new URL(location.href);
    u.searchParams.set('color', n);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    track('select_color', { producto: D.nombre, color: n, sku: c.sku });
  }
}
$$('.sw').forEach((b) => b.addEventListener('click', () => pickColor(b.dataset.color!)));
const qc = new URLSearchParams(location.search).get('color');
if (qc && qc !== col.n) pickColor(qc, false);

// ---------- Talle ----------
$$('.sz').forEach((b) => b.addEventListener('click', () => {
  talle = b.dataset.talle!;
  $$('.sz').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  syncTexts();
  track('select_talle', { producto: D.nombre, talle, color: col.n });
}));

// ---------- Carrito ----------
$$('[data-add]').forEach((b) => b.addEventListener('click', () => {
  if (D.conTalles && !talle) {
    w.tcFlash?.('SELECCIONÁ UN TALLE');
    document.getElementById('sz-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const f = col.fotos[0];
  cart.add({ n: D.nombre, sku: col.sku, img: f ? f.thumb : null, variant: D.conTalles ? `${col.n} · TALLE ${talle}` : col.n, qty: 1, mp: precio() });
  track('add_to_cart', { producto: D.nombre, sku: col.sku, color: col.n, talle: talle || '', valor: precio() });
  w.tcOpen?.('cart');
}));

// ---------- Barra fija mobile ----------
const sticky = $('#sticky');
const onSc = () => { if (sticky) sticky.hidden = !(window.innerWidth < 1024 && window.scrollY > 700); };
window.addEventListener('scroll', onSc, { passive: true });
onSc();

// ---------- Descripción y especificaciones (mobile) ----------
$('#desc-tg')?.addEventListener('click', (e) => {
  const b = e.currentTarget as HTMLButtonElement, r = $('#desc-rest')!;
  const open = !r.classList.contains('open');
  r.classList.toggle('open', open);
  b.textContent = open ? 'LEER MENOS −' : 'LEER DESCRIPCIÓN COMPLETA +';
  b.setAttribute('aria-expanded', String(open));
});
$('#specs-tg')?.addEventListener('click', (e) => {
  const b = e.currentTarget as HTMLButtonElement, s = $('#specs')!;
  const open = !s.classList.contains('open');
  s.classList.toggle('open', open);
  b.textContent = open ? 'VER MENOS −' : `VER TODAS LAS ESPECIFICACIONES (${s.children.length}) +`;
  b.setAttribute('aria-expanded', String(open));
});

// ---------- Asistente de talles ----------
const SZ = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
let fit = 1;
function calc() {
  const h = +($<HTMLInputElement>('#sa-h')?.value || 178), wt = +($<HTMLInputElement>('#sa-w')?.value || 80);
  let i = wt < 70 ? 0 : wt < 80 ? 1 : wt < 92 ? 2 : wt < 104 ? 3 : wt < 116 ? 4 : wt < 128 ? 5 : wt < 142 ? 6 : 7;
  if (fit === 0) i = Math.max(0, i - 1);
  if (fit === 2) i = Math.min(SZ.length - 1, i + 1);
  if (h > 188) i = Math.min(SZ.length - 1, i + 1);
  $('#sa-h-v')!.textContent = String(h);
  $('#sa-w-v')!.textContent = String(wt);
  $('#sa-res')!.textContent = SZ[i];
}
if ($('#calc')) {
  $$('[data-open-calc]').forEach((b) => b.addEventListener('click', () => { w.tcOpen?.('calc'); calc(); }));
  ['#sa-h', '#sa-w'].forEach((s) => $(s)?.addEventListener('input', calc));
  $$('[data-fit]').forEach((b) => b.addEventListener('click', () => { fit = +b.dataset.fit!; $$('[data-fit]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); calc(); }));
  $('#calc')!.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('[data-stop]')) w.tcClose?.(); });
}

syncTexts();
