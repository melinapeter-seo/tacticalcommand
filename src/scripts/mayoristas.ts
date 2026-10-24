// Portal mayorista: cantidades por producto/color/talle, barra con total y resumen que se envía por WhatsApp.
import { money, waLink } from './cart';
import { track } from './track';

type Img = { t: string; s: string; ss: string; f: string };
type Size = { t: string; sp: boolean; p: number };
type Color = { n: string; sw: string; sku: string; g: Img[]; sizes: Size[] };
type Row = { slug: string; n: string; sku: string; cat: string; price: { min: number; varia: boolean }; to: string; colors: Color[] };
const D: { min: number; rows: Row[] } = JSON.parse(document.getElementById('ws-data')!.textContent!);
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));
const w = window as any;
const p2 = (n: number) => String(n).padStart(2, '0');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const KEY = 'tc-ws';
let qty: Record<string, number> = {};
try { qty = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { qty = {}; }
const color: Record<string, string> = {};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(qty)); } catch { /* sin storage */ } };
const q = (k: string) => qty[k] || 0;
const rowOf = (slug: string) => D.rows.find((r) => r.slug === slug)!;
const colOf = (r: Row) => r.colors.find((c) => c.n === color[r.slug]) || r.colors[0];
const subOf = (r: Row) => r.colors.reduce((a, x) => a + x.sizes.reduce((b, z) => b + q(`${r.slug}|${x.n}|${z.t}`) * z.p, 0), 0);
const unitsOf = (r: Row, c?: Color) => (c ? [c] : r.colors).reduce((a, x) => a + x.sizes.reduce((b, z) => b + q(`${r.slug}|${x.n}|${z.t}`), 0), 0);
// Los estilos con scope de Astro necesitan el atributo del componente en el HTML generado acá.
const cid = Array.from($('#ws-rows')!.attributes).find((a) => a.name.startsWith('data-astro-cid'))?.name || '';
const scope = (el: Element) => { if (cid) el.querySelectorAll('*').forEach((e) => e.setAttribute(cid, '')); };

function renderPanel(art: HTMLElement) {
  const r = rowOf(art.dataset.slug!), c = colOf(r), panel = $('.panel', art)!;
  const ci = r.colors.indexOf(c);
  const off = r.colors.slice(0, ci).reduce((a, x) => a + x.g.length, 0);
  const ru = unitsOf(r);
  panel.innerHTML = `
    <div>
      <div class="lbl"><span>GALERÍA · ${esc(c.n)}</span><span>${p2(c.g.length)} FOTOS</span></div>
      <div class="gal" data-noscrollbar>${c.g.map((g, i) => `<button type="button" class="gb" data-gi="${off + i}" aria-label="Ampliar foto ${i + 1}"><img src="${g.t}" alt="${esc(r.n + ' ' + c.n + ' foto ' + (i + 1))}" loading="lazy" width="240" height="300"><span>${p2(i + 1)}</span></button>`).join('')}</div>
      <a href="${r.to}${r.colors.length > 1 ? '?color=' + encodeURIComponent(c.n) : ''}" class="ficha">VER FICHA COMPLETA →</a>
    </div>
    <div class="r">
      ${r.colors.length > 1 ? `<div><div class="lbl"><span>COLOR</span></div><div class="cols">${r.colors.map((x) => { const u = unitsOf(r, x); return `<button type="button" class="cb" data-c="${esc(x.n)}" aria-pressed="${x === c}"><i style="background:${x.sw}"></i>${esc(x.n)}${u ? `<b>${p2(u)}</b>` : ''}</button>`; }).join('')}</div></div>` : ''}
      <div>
        <div class="lbl"><span>${c.sizes[0].t === 'UNIDAD' ? 'CANTIDAD' : 'CANTIDADES POR TALLE'}</span><span style="color:#9AA09A">${esc(c.n)}</span></div>
        <div class="szs">${c.sizes.map((z) => { const k = `${r.slug}|${c.n}|${z.t}`, v = q(k); return `<div class="sz${v ? ' on' : ''}"><div class="szt"><span>${esc(z.t)}</span>${z.sp ? '<em>A CONFIRMAR</em>' : ''}</div><div class="ctl"><button type="button" data-k="${esc(k)}" data-d="-1" aria-label="Restar ${esc(z.t)}">−</button><output aria-live="polite">${p2(v)}</output><button type="button" data-k="${esc(k)}" data-d="1" aria-label="Sumar ${esc(z.t)}">+</button></div></div>`; }).join('')}</div>
        ${c.sizes.some((z) => z.sp) ? '<div style="margin-top:10px;font-family:var(--mono);font-size:10px;line-height:1.8;color:#9AA09A">Los talles marcados A CONFIRMAR se validan antes de aprobar el pedido.</div>' : ''}
      </div>
      <div class="sub"><div><span class="k">${ru ? `SUBTOTAL · ${ru} UN.` : 'SUBTOTAL'}</span><span class="v">${ru ? money(subOf(r)) : '—'}</span></div>${ru ? '<button type="button" class="clr">VACIAR ARTÍCULO</button>' : ''}</div>
    </div>`;
  scope(panel);
}

function renderRow(art: HTMLElement) {
  const r = rowOf(art.dataset.slug!), c = colOf(r), ru = unitsOf(r);
  const open = !$('.panel', art)!.hidden;
  art.classList.toggle('has', ru > 0);
  art.classList.toggle('open', open);
  $('[data-units]', art)!.textContent = ru ? `${p2(ru)} UN.` : '—';
  const tg = $('[data-toggle]', art)!;
  tg.textContent = open ? 'CERRAR −' : ru ? 'EDITAR CANTIDADES' : 'CARGAR CANTIDADES +';
  tg.setAttribute('aria-expanded', String(open));
  $('[data-rsku]', art)!.textContent = c.sku || r.sku;
  const im = $<HTMLImageElement>('.thumb img', art);
  if (im && c.g[0]) { im.src = c.g[0].t; im.alt = `${r.n} ${c.n}`; }
  $$('.dots span', art).forEach((s, i) => s.classList.toggle('on', r.colors.length > 1 && r.colors[i] === c));
  if (open) renderPanel(art);
}

function lines() {
  const out: { n: string; v: string; qty: number; unit: string; sub: string; total: number }[] = [];
  for (const r of D.rows) for (const c of r.colors) for (const z of c.sizes) {
    const v = q(`${r.slug}|${c.n}|${z.t}`);
    if (v) out.push({ n: r.n, v: z.t === 'UNIDAD' ? c.n : `${c.n} / ${z.t}`, qty: v, unit: money(z.p), sub: money(v * z.p), total: v * z.p });
  }
  return out;
}

function renderTotals() {
  const ls = lines();
  const units = ls.reduce((a, l) => a + l.qty, 0), total = ls.reduce((a, l) => a + l.total, 0);
  const prods = D.rows.filter((r) => unitsOf(r) > 0).length;
  const ok = units >= D.min, faltan = D.min - units, pct = Math.min(100, (units / D.min) * 100).toFixed(1) + '%';
  $('#ws-units')!.textContent = String(units);
  $('#ws-prods')!.textContent = p2(prods);
  $('#ws-total')!.textContent = money(total);
  const m = $('#ws-min')!;
  m.textContent = ok ? 'MÍNIMO MAYORISTA ALCANZADO' : `MÍNIMO ${D.min} UNIDADES · ${faltan === 1 ? 'FALTA 1' : `FALTAN ${faltan}`}`;
  m.classList.toggle('ok', ok);
  $('#ws-pct')!.style.width = pct;
  // Resumen
  const ql = $('#q-lines')!;
  ql.innerHTML = ls.length ? ls.map((l) => `<div class="l"><span>${esc(l.n)}</span><span>${esc(l.v)}</span><span>${l.qty} UN.</span><span>${l.unit}</span><span>${l.sub}</span></div>`).join('') : '<div class="e">SIN UNIDADES SELECCIONADAS.<br>AGREGÁ CANTIDADES EN EL CATÁLOGO.</div>';
  scope(ql);
  $('#q-total')!.textContent = money(total);
  $('#q-minbox')!.classList.toggle('ok', ok);
  $('#q-minst')!.textContent = ok ? 'ALCANZADO ✓' : `${units} / ${D.min} · ${faltan === 1 ? 'FALTA 1 UNIDAD' : `FALTAN ${faltan} UNIDADES`}`;
  $('#q-minpct')!.style.width = pct;
  const enable = ok && ls.length > 0;
  const wa = $<HTMLAnchorElement>('#q-wa')!;
  wa.hidden = !enable; $('#q-no')!.hidden = enable;
  wa.href = waLink('Hola Walter! Quiero cotizar esta compra mayorista:\n\n' + ls.map((l, i) => `${i + 1}. ${l.n} (${l.v.toLowerCase()}) x${l.qty} - ${l.sub}`).join('\n') + `\n\nSubtotal a precio publicado: ${money(total)}\n\n¿Me confirmás el precio mayorista, stock y envío?`);
  wa.dataset.track = JSON.stringify({ tipo: 'mayorista', qty: units, valor: total });
}

$('#ws-rows')!.addEventListener('click', (e) => {
  const t = e.target as HTMLElement, art = t.closest<HTMLElement>('.row');
  if (!art) return;
  const r = rowOf(art.dataset.slug!);
  if (t.closest('[data-toggle]')) { const p = $('.panel', art)!; p.hidden = !p.hidden; renderRow(art); return; }
  const gal = t.closest<HTMLElement>('[data-gal], [data-gi]');
  if (gal) {
    const flat = r.colors.flatMap((x) => x.g.map((g, i) => ({ src: g.f, alt: `${r.n} ${x.n} foto ${i + 1}`, label: r.colors.length > 1 ? x.n : '' })));
    const c = colOf(r), start = gal.dataset.gi ? +gal.dataset.gi : r.colors.slice(0, r.colors.indexOf(c)).reduce((a, x) => a + x.g.length, 0);
    if (flat.length) w.tcLightbox?.(flat, start);
    return;
  }
  const cb = t.closest<HTMLElement>('[data-c]');
  if (cb) { color[r.slug] = cb.dataset.c!; renderRow(art); return; }
  const step = t.closest<HTMLElement>('[data-k]');
  if (step) {
    const k = step.dataset.k!, d = +step.dataset.d!;
    qty[k] = Math.max(0, q(k) + d);
    if (!qty[k]) delete qty[k];
    save(); renderRow(art); renderTotals();
    if (d > 0) track('add_to_wholesale', { producto: r.n, sku: colOf(r).sku, color: colOf(r).n, talle: k.split('|')[2], qty: qty[k] || 0 });
    return;
  }
  if (t.closest('.clr')) {
    Object.keys(qty).forEach((k) => { if (k.startsWith(r.slug + '|')) delete qty[k]; });
    save(); renderRow(art); renderTotals();
  }
});

// Filtros por categoría y búsqueda.
let cat = 'TODO';
function filter() {
  const s = ($<HTMLInputElement>('#ws-q')!.value || '').trim().toLowerCase();
  let n = 0;
  $$('.row').forEach((a) => { const ok = (cat === 'TODO' || a.dataset.cat === cat) && (!s || a.dataset.q!.includes(s)); a.hidden = !ok; if (ok) n++; });
  $('#ws-res')!.textContent = p2(n) + (n === 1 ? ' ARTÍCULO' : ' ARTÍCULOS') + (cat !== 'TODO' ? ' · ' + cat : '');
  $('#ws-empty')!.hidden = n > 0;
}
$$('.cat').forEach((b) => b.addEventListener('click', () => { cat = b.dataset.cat!; $$('.cat').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); filter(); }));
$('#ws-q')!.addEventListener('input', filter);

$('#ws-open')!.addEventListener('click', () => w.tcOpen?.('quote'));
$('#quote')!.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('[data-stop]')) w.tcClose?.(); });

$$('.row').forEach(renderRow);
renderTotals();
