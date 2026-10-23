// Interacciones compartidas por todas las páginas: header, overlays, carrito, buscador, toasts,
// aparición al hacer scroll, carruseles horizontales y visor de fotos.
import { cart, cartTotal, cartWaLink, money, type CartItem } from './cart';
import { track } from './track';

const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));

// ---------- Header ----------
const hdr = $('#hdr');
const onScroll = () => hdr?.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Overlays ----------
let lastFocus: HTMLElement | null = null;
function open(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  lastFocus = document.activeElement as HTMLElement;
  el.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  $$('[data-open="menu"]').forEach((b) => b.setAttribute('aria-expanded', String(id === 'menu')));
  if (id === 'search') { renderSearch(''); setTimeout(() => $<HTMLInputElement>('#q')?.focus(), 30); }
  if (id === 'cart') renderCart();
  setTimeout(() => (el.querySelector<HTMLElement>('[data-close]'))?.focus({ preventScroll: true }), id === 'search' ? 60 : 0);
}
function closeAll() {
  $$('.ov').forEach((o) => (o.hidden = true));
  document.documentElement.style.overflow = '';
  $$('[data-open="menu"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  lastFocus?.focus?.({ preventScroll: true });
}
(window as any).tcOpen = open;
(window as any).tcClose = closeAll;
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const op = t.closest<HTMLElement>('[data-open]');
  if (op) { e.preventDefault(); open(op.dataset.open!); return; }
  if (t.closest('[data-close]')) { closeAll(); return; }
  const ov = t.closest('.ov');
  if (ov && (ov.id === 'cart' || ov.id === 'lb') && !t.closest('[data-stop]') && !t.closest('button')) closeAll();
  if (t.closest('#menu a')) closeAll();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

// ---------- Toast ----------
let toastT: number | undefined;
export function flash(msg: string) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastT);
  toastT = window.setTimeout(() => (el.hidden = true), 2800);
}
(window as any).tcFlash = flash;

// ---------- Carrito ----------
function renderCart() {
  const items = cart.get();
  $$('[data-cart-count]').forEach((n) => (n.textContent = String(items.length)));
  const list = $('#cart-list');
  if (!list) return;
  if (!items.length) list.innerHTML = '<div class="empty">CARRITO VACÍO.<br>AGREGÁ UN PRODUCTO DESDE UNA FICHA.</div>';
  else {
    list.innerHTML = '';
    items.forEach((c: CartItem, i: number) => {
      const it = document.createElement('div');
      it.className = 'it';
      it.innerHTML = `<img alt="" loading="lazy"><div class="b"><div class="sku"></div><div class="n"></div><div class="v"></div><div class="r"><div class="q"></div><button type="button" class="rm">QUITAR</button></div></div>`;
      const img = it.querySelector('img')!;
      if (c.img) img.src = c.img; else img.removeAttribute('src');
      img.alt = c.n;
      it.querySelector('.sku')!.textContent = c.sku;
      it.querySelector('.n')!.textContent = c.n;
      it.querySelector('.v')!.textContent = c.variant || '';
      it.querySelector('.q')!.textContent = `${c.qty} UN. · ${c.mp ? money(c.mp * c.qty) : 'PRECIO A CONFIRMAR'}`;
      it.querySelector('.rm')!.addEventListener('click', () => { cart.remove(i); renderCart(); });
      list.appendChild(it);
    });
  }
  const tot = cartTotal(items);
  const totEl = $('#cart-total');
  if (totEl) totEl.textContent = tot > 0 && items.every((c) => c.mp > 0) ? money(tot) : 'A CONFIRMAR';
  const cta = $('#cart-cta');
  if (cta) cta.hidden = !items.length;
  const wa = $<HTMLAnchorElement>('#cart-wa');
  if (wa) wa.href = cartWaLink(items);
}
(window as any).tcRenderCart = renderCart;
window.addEventListener('tc-cart', renderCart);
window.addEventListener('storage', (e) => { if (e.key === cart.KEY) renderCart(); });
renderCart();

// ---------- Buscador ----------
const idxEl = $('#sr-idx');
const IDX: { k: string; t: string; u: string }[] = idxEl ? JSON.parse(idxEl.textContent || '[]') : [];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function renderSearch(q: string) {
  const res = $('#sr-res'), lbl = $('#sr-lbl');
  if (!res || !lbl) return;
  const qq = norm(q.trim());
  const list = (qq ? IDX.filter((r) => norm(r.t + ' ' + r.k).includes(qq)) : IDX).slice(0, 8);
  lbl.textContent = q.trim() ? 'RESULTADOS / ' + q.trim().toUpperCase() : 'SUGERENCIAS';
  res.innerHTML = '';
  if (!list.length) { res.innerHTML = '<p style="font-size:15px;color:#9AA09A;padding:14px 0">No encontramos resultados. Probá con otra palabra o escribinos por WhatsApp.</p>'; return; }
  for (const r of list) {
    const a = document.createElement('a');
    a.href = r.u;
    a.innerHTML = '<span class="k"></span><span class="t"></span><span class="a" aria-hidden="true">→</span>';
    a.querySelector('.k')!.textContent = r.k;
    a.querySelector('.t')!.textContent = r.t;
    res.appendChild(a);
  }
}
$<HTMLInputElement>('#q')?.addEventListener('input', (e) => renderSearch((e.target as HTMLInputElement).value));
$<HTMLInputElement>('#q')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = $<HTMLAnchorElement>('#sr-res a'); if (a) location.href = a.href; } });

// ---------- Aparición al hacer scroll ----------
const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (motion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  $$('[data-reveal]').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.classList.add('rv-wait');
    io.observe(el);
  });
}

// ---------- Carruseles horizontales con flechas ----------
$$('[data-scroller]').forEach((el) => {
  const box = el.parentElement!;
  const prev = box.querySelector<HTMLButtonElement>('[data-prev]');
  const next = box.querySelector<HTMLButtonElement>('[data-next]');
  const measure = () => {
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const max = el.scrollWidth - el.clientWidth, pos = el.scrollLeft - pad;
    if (next) next.hidden = !(max > pad + 8 && pos < max - pad - 8);
    if (prev) prev.hidden = !(max > pad + 8 && pos > 8);
  };
  const slide = (d: number) => el.scrollBy({ left: d * el.clientWidth * 0.8, behavior: 'smooth' });
  prev?.addEventListener('click', () => slide(-1));
  next?.addEventListener('click', () => slide(1));
  el.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('resize', measure);
  requestAnimationFrame(measure);
});

// ---------- Visor de fotos (lightbox) ----------
type LbItem = { src: string; alt: string; label?: string };
let lbItems: LbItem[] = [], lbI = 0;
function lbShow() {
  const it = lbItems[lbI];
  const im = $<HTMLImageElement>('#lb-img');
  if (!it || !im) return;
  im.src = it.src; im.alt = it.alt;
  const multi = lbItems.length > 1;
  ['#lb-prev', '#lb-next', '#lb-count'].forEach((s) => { const e = $(s); if (e) e.hidden = !multi; });
  const c = $('#lb-count');
  if (c) c.textContent = (it.label ? it.label + ' · ' : '') + (lbI + 1) + ' / ' + lbItems.length;
}
export function lightbox(items: LbItem[], i = 0) { lbItems = items; lbI = i; lbShow(); open('lb'); }
(window as any).tcLightbox = lightbox;
const lbGo = (d: number) => { lbI = (lbI + d + lbItems.length) % lbItems.length; lbShow(); };
$('#lb-prev')?.addEventListener('click', (e) => { e.stopPropagation(); lbGo(-1); });
$('#lb-next')?.addEventListener('click', (e) => { e.stopPropagation(); lbGo(1); });
document.addEventListener('keydown', (e) => { if ($('#lb')?.hidden !== false) return; if (e.key === 'ArrowRight') lbGo(1); if (e.key === 'ArrowLeft') lbGo(-1); });
let tx = 0;
$('#lb')?.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
$('#lb')?.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) lbGo(dx < 0 ? 1 : -1); });

// ---------- Medición: cada clic a WhatsApp es la venta ----------
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="wa.me/"]');
  if (a) track('whatsapp_click', { origen: a.dataset.wa || 'link', ...(a.dataset.track ? JSON.parse(a.dataset.track) : {}) });
});
