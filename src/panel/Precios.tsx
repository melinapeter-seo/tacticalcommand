// Precios: precio de cada producto, por color y por talle, y ajuste masivo con redondeo y vista previa.
// Se guardan en el borrador y se ven en la web al publicar.
import { useMemo, useState } from 'react';
import type { Producto } from './datos';
import { CATEGORIAS, cap, money } from './datos';
import { aFilas } from './modelo';
import { llamar } from './api';
import { Boton, Campo, Encabezado, usePanel } from './ui';

const pesos = (v: string) => Number(v.replace(/\D/g, '')) || 0;
const fmt = (n: number | null | undefined) => (n ? n.toLocaleString('es-AR') : '');
const REDONDEOS = [
  { k: 'no', t: 'Sin redondear', f: (n: number) => Math.round(n) },
  { k: '100', t: 'A $ 100', f: (n: number) => Math.round(n / 100) * 100 },
  { k: '1000', t: 'A $ 1.000', f: (n: number) => Math.round(n / 1000) * 1000 },
  { k: '900', t: 'Que termine en 900', f: (n: number) => Math.max(900, Math.round((n + 100) / 1000) * 1000 - 100) },
];

export default function Precios() {
  const { bor, pub, recargar, hacer, ocupado, confirmar } = usePanel();
  const [lista, setLista] = useState<Producto[]>(() => structuredClone(bor));
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [masivo, setMasivo] = useState(false);
  const cambiado = JSON.stringify(lista) !== JSON.stringify(bor);
  const visibles = useMemo(() => lista.filter((p) => (!cat || p.categoria === cat) && (!q.trim() || p.nombre.toLowerCase().includes(q.trim().toLowerCase()))), [lista, q, cat]);
  const cambiar = (slug: string, f: (p: Producto) => Producto) => setLista((l) => l.map((p) => (p.slug === slug ? f(structuredClone(p)) : p)));

  async function guardar() {
    const filas = lista.map(aFilas);
    const ok = await hacer(() => llamar('saveDraft', { productos: filas.map((f) => f.producto), variantes: filas.flatMap((f) => f.variantes) }), 'Precios guardados. Quedan en «Cambios sin publicar».');
    if (ok) await recargar();
  }
  async function descartar() {
    if (await confirmar({ titulo: '¿Descartar los precios que cambiaste?', si: 'Descartar', peligro: true })) setLista(structuredClone(bor));
  }

  return (
    <section className="sec">
      <Encabezado titulo="Precios" texto="Cambiá el precio de lista de cada producto. Si un color o un talle cuesta distinto, abrí «Colores y talles»." accion={<Boton onClick={() => setMasivo(true)}>% Ajuste masivo</Boton>} />
      <input className="buscar" type="search" placeholder="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar productos" />
      <div className="chips">
        <button type="button" className="chip" aria-selected={!cat} onClick={() => setCat('')}>Todos</button>
        {CATEGORIAS.map((c) => <button key={c} type="button" className="chip" aria-selected={cat === c} onClick={() => setCat(c)}>{cap(c)}</button>)}
      </div>
      <ul className="lista">
        {visibles.map((p) => {
          const publicado = pub.find((x) => x.slug === p.slug);
          const distinto = publicado && publicado.precio !== p.precio;
          const varios = p.colores.some((c) => c.precio != null || Object.keys(c.precios_talle).length);
          return (
            <li key={p.slug} className={`precio-f ${distinto ? 'mod' : ''}`}>
              <div className="precio-a">
                <span className="mini">{p.colores[0]?.fotos[0]?.url ? <img src={p.colores[0].fotos[0].url} alt="" loading="lazy" /> : null}</span>
                <span className="fila-txt">
                  <span className="fila-n">{p.nombre}</span>
                  <span className="fila-d">{distinto ? `En la web: ${money(publicado!.precio)}` : cap(p.categoria)}{varios ? ' · tiene precios por color o talle' : ''}</span>
                </span>
                <label className="precio-in"><span className="sr">Precio de {p.nombre}</span><span aria-hidden="true">$</span>
                  <input inputMode="numeric" value={fmt(p.precio)} onChange={(e) => cambiar(p.slug, (x) => ({ ...x, precio: pesos(e.target.value) }))} />
                </label>
              </div>
              <Boton tipo="txt" onClick={() => setAbierto(abierto === p.slug ? null : p.slug)} aria-expanded={abierto === p.slug}>{abierto === p.slug ? 'Cerrar' : 'Colores y talles'}</Boton>
              {abierto === p.slug && (
                <div className="precio-v">
                  {p.colores.map((c, i) => (
                    <div key={c.nombre} className="precio-c">
                      <Campo label={cap(c.nombre)} ayuda="Vacío = usa el precio del producto">
                        <input inputMode="numeric" placeholder={`Igual al producto (${money(p.precio)})`} value={fmt(c.precio)}
                          onChange={(e) => cambiar(p.slug, (x) => { x.colores[i].precio = pesos(e.target.value) || null; return x; })} />
                      </Campo>
                      {[...c.talles, ...c.ninos].length > 0 && (
                        <div className="talles-p">
                          {[...c.talles, ...c.ninos].map((t) => (
                            <label key={t} className="talle-p"><span>{c.ninos.includes(t) ? `${t} niños` : t}</span>
                              <input inputMode="numeric" placeholder={fmt(c.precio ?? p.precio)} value={fmt(c.precios_talle[t])}
                                onChange={(e) => cambiar(p.slug, (x) => { const v = pesos(e.target.value); if (v) x.colores[i].precios_talle[t] = v; else delete x.colores[i].precios_talle[t]; return x; })} />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {cambiado && (
        <div className="acciones-fijas acciones-dos">
          <Boton onClick={descartar} disabled={ocupado}>Descartar</Boton>
          <Boton tipo="pri" onClick={guardar} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar precios'}</Boton>
        </div>
      )}
      {masivo && <AjusteMasivo lista={lista} cerrar={() => setMasivo(false)} aplicar={(l) => { setLista(l); setMasivo(false); }} />}
    </section>
  );
}

function AjusteMasivo({ lista, cerrar, aplicar }: { lista: Producto[]; cerrar: () => void; aplicar: (l: Producto[]) => void }) {
  const [alcance, setAlcance] = useState('');
  const [sentido, setSentido] = useState(1);
  const [pct, setPct] = useState(10);
  const [red, setRed] = useState('100');
  const f = REDONDEOS.find((r) => r.k === red)!.f;
  const ajustar = (n: number) => f(n * (1 + (sentido * pct) / 100));
  const afectados = lista.filter((p) => !alcance || p.categoria === alcance);
  const nueva = () => lista.map((p) => {
    if (alcance && p.categoria !== alcance) return p;
    const x = structuredClone(p);
    x.precio = ajustar(x.precio);
    for (const c of x.colores) {
      if (c.precio != null) c.precio = ajustar(c.precio);
      for (const t of Object.keys(c.precios_talle)) c.precios_talle[t] = ajustar(c.precios_talle[t]);
    }
    return x;
  });
  return (
    <div className="modal-fondo" onClick={cerrar}>
      <div className="modal modal-g" role="dialog" aria-modal="true" aria-labelledby="am-t" onClick={(e) => e.stopPropagation()}>
        <h2 id="am-t">Ajuste masivo de precios</h2>
        <p>También ajusta los precios por color y por talle. Después revisás y guardás.</p>
        <Campo label="¿A qué productos?">
          <select value={alcance} onChange={(e) => setAlcance(e.target.value)}><option value="">Todos ({lista.length})</option>{CATEGORIAS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select>
        </Campo>
        <div className="dos">
          <Campo label="Subir o bajar"><select value={sentido} onChange={(e) => setSentido(+e.target.value)}><option value={1}>Subir</option><option value={-1}>Bajar</option></select></Campo>
          <Campo label="Porcentaje"><input inputMode="numeric" value={pct} onChange={(e) => setPct(Math.min(90, pesos(e.target.value)))} /></Campo>
        </div>
        <Campo label="Redondeo"><select value={red} onChange={(e) => setRed(e.target.value)}>{REDONDEOS.map((r) => <option key={r.k} value={r.k}>{r.t}</option>)}</select></Campo>
        <span className="campo-l">Vista previa</span>
        <ul className="rev rev-p">{afectados.slice(0, 6).map((p) => <li key={p.slug}><span>{p.nombre}</span><span>{money(p.precio)} → <b>{money(ajustar(p.precio))}</b></span></li>)}</ul>
        {afectados.length > 6 && <p className="ayuda">y {afectados.length - 6} productos más.</p>}
        <div className="modal-b">
          <Boton onClick={cerrar}>Cancelar</Boton>
          <Boton tipo="pri" onClick={() => aplicar(nueva())} disabled={!pct}>Aplicar a {afectados.length}</Boton>
        </div>
      </div>
    </div>
  );
}
