// Precios: minorista y mayorista de cada producto, por color y por talle, y ajuste masivo con redondeo y vista previa.
// El mayorista es privado: lo ve solo el panel (el catálogo público de la API no lo devuelve).
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
  const { todo, bor, pub, recargar, hacer, ocupado, confirmar } = usePanel();
  // Apps Script anterior a los precios mayoristas: no tiene la columna, así que no se podrían guardar.
  const conMay = 'precio_mayorista' in (todo.productos_draft[0] || {});
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
      <Encabezado titulo="Precios" texto="Precio minorista (el que se ve en la web) y mayorista de cada producto. Si un color o un talle cuesta distinto, abrí «Colores y talles»." accion={<Boton onClick={() => setMasivo(true)}>% Ajuste masivo</Boton>} />
      {!conMay && <div className="demo">Para cargar precios mayoristas falta actualizar el código de la planilla. Avisale a Melina.</div>}
      <input className="buscar" type="search" placeholder="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar productos" />
      <div className="chips">
        <button type="button" className="chip" aria-selected={!cat} onClick={() => setCat('')}>Todos</button>
        {CATEGORIAS.map((c) => <button key={c} type="button" className="chip" aria-selected={cat === c} onClick={() => setCat(c)}>{cap(c)}</button>)}
      </div>
      <ul className="lista">
        {visibles.map((p) => {
          const publicado = pub.find((x) => x.slug === p.slug);
          const distinto = publicado && publicado.precio !== p.precio;
          const distintoMay = publicado && publicado.precio_may !== p.precio_may;
          const varios = p.colores.some((c) => c.precio != null || Object.keys(c.precios_talle).length || c.precio_may != null || Object.keys(c.precios_talle_may).length);
          return (
            <li key={p.slug} className={`precio-f ${distinto || distintoMay ? 'mod' : ''}`}>
              <div className="precio-a">
                <span className="mini">{p.colores[0]?.fotos[0]?.url ? <img src={p.colores[0].fotos[0].url} alt="" loading="lazy" /> : null}</span>
                <span className="fila-txt">
                  <span className="fila-n">{p.nombre}</span>
                  <span className="fila-d">{cap(p.categoria)}{varios ? ' · tiene precios por color o talle' : ''}</span>
                </span>
              </div>
              <div className="precio-2">
                <label className="precio-in"><span className="precio-l">Minorista</span>
                  <span className="precio-c-in"><span aria-hidden="true">$</span><input inputMode="numeric" aria-label={`Precio minorista de ${p.nombre}`} placeholder="0" value={fmt(p.precio)} onChange={(e) => cambiar(p.slug, (x) => ({ ...x, precio: pesos(e.target.value) }))} /></span>
                  {distinto && <span className="precio-w">En la web: {money(publicado!.precio)}</span>}
                </label>
                <label className="precio-in may"><span className="precio-l">Mayorista</span>
                  <span className="precio-c-in"><span aria-hidden="true">$</span><input inputMode="numeric" aria-label={`Precio mayorista de ${p.nombre}`} placeholder="0" disabled={!conMay} value={fmt(p.precio_may)} onChange={(e) => cambiar(p.slug, (x) => ({ ...x, precio_may: pesos(e.target.value) }))} /></span>
                  {distintoMay && <span className="precio-w">Publicado: {publicado!.precio_may ? money(publicado!.precio_may) : 'sin cargar'}</span>}
                </label>
              </div>
              <Boton tipo="txt" onClick={() => setAbierto(abierto === p.slug ? null : p.slug)} aria-expanded={abierto === p.slug}>{abierto === p.slug ? 'Cerrar' : 'Colores y talles'}</Boton>
              {abierto === p.slug && (
                <div className="precio-v">
                  {p.colores.map((c, i) => {
                    const tt = [...c.talles, ...c.ninos];
                    return (
                      <div key={c.nombre} className="precio-c">
                        <span className="precio-cn">{cap(c.nombre)}</span>
                        <div className="dos">
                          <Campo label="Minorista" ayuda="Vacío = igual al producto">
                            <input inputMode="numeric" placeholder={fmt(p.precio) || '0'} value={fmt(c.precio)}
                              onChange={(e) => cambiar(p.slug, (x) => { x.colores[i].precio = pesos(e.target.value) || null; return x; })} />
                          </Campo>
                          <Campo label="Mayorista" ayuda="Vacío = igual al producto">
                            <input inputMode="numeric" placeholder={fmt(p.precio_may) || '0'} disabled={!conMay} value={fmt(c.precio_may)}
                              onChange={(e) => cambiar(p.slug, (x) => { x.colores[i].precio_may = pesos(e.target.value) || null; return x; })} />
                          </Campo>
                        </div>
                        {tt.length > 0 && (
                          <>
                            <span className="campo-l">Por {p.categoria === 'CALZADO' ? 'número' : 'talle'} <span className="opc">Vacío = igual al color</span></span>
                            <div className="talles-p">
                              {tt.map((t) => (
                                <div key={t} className="talle-p"><span className="talle-pn">{c.ninos.includes(t) ? `${t} niños` : t}</span>
                                  <label><span>Min.</span><input inputMode="numeric" aria-label={`Minorista ${t}`} placeholder={fmt(c.precio ?? p.precio) || '0'} value={fmt(c.precios_talle[t])}
                                    onChange={(e) => cambiar(p.slug, (x) => { const v = pesos(e.target.value); if (v) x.colores[i].precios_talle[t] = v; else delete x.colores[i].precios_talle[t]; return x; })} /></label>
                                  <label className="may"><span>May.</span><input inputMode="numeric" aria-label={`Mayorista ${t}`} disabled={!conMay} placeholder={fmt(c.precio_may ?? p.precio_may) || '0'} value={fmt(c.precios_talle_may[t])}
                                    onChange={(e) => cambiar(p.slug, (x) => { const v = pesos(e.target.value); if (v) x.colores[i].precios_talle_may[t] = v; else delete x.colores[i].precios_talle_may[t]; return x; })} /></label>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
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
  const [cuales, setCuales] = useState<'min' | 'may' | 'ambos'>('min');
  const min = cuales !== 'may', may = cuales !== 'min';
  const [sentido, setSentido] = useState(1);
  const [pct, setPct] = useState(10);
  const [red, setRed] = useState('100');
  const f = REDONDEOS.find((r) => r.k === red)!.f;
  const ajustar = (n: number) => f(n * (1 + (sentido * pct) / 100));
  const afectados = lista.filter((p) => !alcance || p.categoria === alcance);
  const nueva = () => lista.map((p) => {
    if (alcance && p.categoria !== alcance) return p;
    const x = structuredClone(p);
    if (min) x.precio = ajustar(x.precio);
    if (may && x.precio_may) x.precio_may = ajustar(x.precio_may);
    for (const c of x.colores) {
      if (min && c.precio != null) c.precio = ajustar(c.precio);
      if (min) for (const t of Object.keys(c.precios_talle)) c.precios_talle[t] = ajustar(c.precios_talle[t]);
      if (may && c.precio_may != null) c.precio_may = ajustar(c.precio_may);
      if (may) for (const t of Object.keys(c.precios_talle_may)) c.precios_talle_may[t] = ajustar(c.precios_talle_may[t]);
    }
    return x;
  });
  return (
    <div className="modal-fondo" onClick={cerrar}>
      <div className="modal modal-g" role="dialog" aria-modal="true" aria-labelledby="am-t" onClick={(e) => e.stopPropagation()}>
        <h2 id="am-t">Ajuste masivo de precios</h2>
        <p>También ajusta los precios por color y por talle. Los mayoristas sin cargar quedan en $ 0. Después revisás y guardás.</p>
        <Campo label="¿Qué precios?">
          <select value={cuales} onChange={(e) => setCuales(e.target.value as 'min' | 'may' | 'ambos')}><option value="min">Minoristas</option><option value="may">Mayoristas</option><option value="ambos">Minoristas y mayoristas</option></select>
        </Campo>
        <Campo label="¿A qué productos?">
          <select value={alcance} onChange={(e) => setAlcance(e.target.value)}><option value="">Todos ({lista.length})</option>{CATEGORIAS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select>
        </Campo>
        <div className="dos">
          <Campo label="Subir o bajar"><select value={sentido} onChange={(e) => setSentido(+e.target.value)}><option value={1}>Subir</option><option value={-1}>Bajar</option></select></Campo>
          <Campo label="Porcentaje"><input inputMode="numeric" value={pct} onChange={(e) => setPct(Math.min(90, pesos(e.target.value)))} /></Campo>
        </div>
        <Campo label="Redondeo"><select value={red} onChange={(e) => setRed(e.target.value)}>{REDONDEOS.map((r) => <option key={r.k} value={r.k}>{r.t}</option>)}</select></Campo>
        <span className="campo-l">Vista previa</span>
        <ul className="rev rev-p">{afectados.slice(0, 6).map((p) => <li key={p.slug}><span>{p.nombre}</span><span>{min && <>{money(p.precio)} → <b>{money(ajustar(p.precio))}</b></>}{min && may && <br />}{may && (p.precio_may ? <>May. {money(p.precio_may)} → <b>{money(ajustar(p.precio_may))}</b></> : <>May. sin cargar</>)}</span></li>)}</ul>
        {afectados.length > 6 && <p className="ayuda">y {afectados.length - 6} productos más.</p>}
        <div className="modal-b">
          <Boton onClick={cerrar}>Cancelar</Boton>
          <Boton tipo="pri" onClick={() => aplicar(nueva())} disabled={!pct}>Aplicar a {afectados.length}</Boton>
        </div>
      </div>
    </div>
  );
}
