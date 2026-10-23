// Carrito minorista. Vive en localStorage para sobrevivir la navegación entre páginas;
// el pedido se envía por WhatsApp (no hay pago online).
export type CartItem = { n: string; sku: string; img: string | null; variant: string; qty: number; mp: number };

export const WA_NUM = '5493492649494';
export const money = (n: number) => '$ ' + n.toLocaleString('es-AR');
export const waLink = (t: string) => `https://wa.me/${WA_NUM}?text=${encodeURIComponent(t)}`;

const KEY = 'tc-cart';
// Si localStorage no está disponible (modo privado estricto), el carrito vive solo en memoria.
let storage = true;
const read = (): CartItem[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { storage = false; return mem; } };
const write = (v: CartItem[]) => { mem = v; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { storage = false; } window.dispatchEvent(new Event('tc-cart')); };
let mem: CartItem[] = [];
mem = read();

export const cart = {
  KEY,
  get: (): CartItem[] => (storage ? read() : mem),
  add: (it: CartItem) => write([...cart.get(), it]),
  remove: (i: number) => write(cart.get().filter((_, j) => j !== i)),
};

export const cartTotal = (items: CartItem[]) => items.reduce((a, c) => a + c.mp * c.qty, 0);

export function cartWaLink(items: CartItem[]) {
  const tot = cartTotal(items);
  const ok = tot > 0 && items.every((c) => c.mp > 0);
  return waLink('Hola Walter! Quiero hacer este pedido:\n\n' + items.map((c, i) => (i + 1) + '. ' + c.n + (c.variant ? ' (' + c.variant.toLowerCase() + ')' : '') + ' x' + c.qty + (c.mp ? ' - ' + money(c.mp * c.qty) : '') + (c.sku && !/confirmar/i.test(c.sku) ? ' [' + c.sku + ']' : '')).join('\n') + (ok ? '\n\nSubtotal: ' + money(tot) : '') + '\n\n¿Me confirmás stock, forma de pago y envío?');
}
