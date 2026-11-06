// Más: condiciones mayoristas, destacados de la home, aviso en la web, fotos de clientes, resumen y cambio de contraseña
// (o de PIN, si todavía no hay usuarios). Los ajustes de la web van al borrador; la contraseña cambia al instante.
import { useMemo, useState } from 'react';
import { cap, comprimirFoto, faltaAvisar, money } from './datos';
import { bool, json, urlFoto } from './modelo';
import { guardarSesion, llamar, sesion } from './api';
import { FormClave } from './Clave';
import { Boton, Campo, Encabezado, Icono, usePanel } from './ui';

const OPCIONES = [
  { k: 'resumen', t: 'Resumen del negocio', d: 'Ventas y pedidos del mes' },
  { k: 'mayoristas', t: 'Mayoristas', d: 'Mínimo, condiciones y envío' },
  { k: 'destacados', t: 'Destacados de la home', d: 'Qué productos se ven primero' },
  { k: 'aviso', t: 'Aviso en la web', d: 'Una franja arriba de todo' },
  { k: 'resenas', t: 'Fotos de clientes', d: '«Garantía de satisfacción»' },
];
const conUsuario = () => !!sesion()?.usuario;

export default function Mas({ salir }: { salir: () => void }) {
  const [sub, setSub] = useState<string | null>(null);
  const volver = () => setSub(null);
  if (sub === 'resumen') return <Resumen volver={volver} />;
  if (sub === 'mayoristas') return <Mayoristas volver={volver} />;
  if (sub === 'destacados') return <Destacados volver={volver} />;
  if (sub === 'aviso') return <Aviso volver={volver} />;
  if (sub === 'resenas') return <Resenas volver={volver} />;
  if (sub === 'pin') return conUsuario() ? <MiClave volver={volver} /> : <Pin volver={volver} />;
  const opciones = [...OPCIONES, conUsuario() ? { k: 'pin', t: 'Cambiar mi contraseña', d: `Entraste como ${sesion()!.usuario}` } : { k: 'pin', t: 'Cambiar el PIN', d: 'La clave para entrar al panel' }];
  return (
    <section className="sec">
      <Encabezado titulo="Más" />
      <ul className="lista">
        {opciones.map((o) => (
          <li key={o.k}><button type="button" className="fila fila-menu" onClick={() => setSub(o.k)}><span className="fila-txt"><span className="fila-n">{o.t}</span><span className="fila-d">{o.d}</span></span><Icono n="flecha" /></button></li>
        ))}
      </ul>
      <Boton tipo="txt" onClick={salir}>Salir del panel</Boton>
    </section>
  );
}

/** Guarda claves de config en el borrador. */
function useGuardarConfig() {
  const { hacer, recargar } = usePanel();
  return async (config: Record<string, string>, ok = 'Guardado. Queda en «Cambios sin publicar».') => {
    const r = await hacer(() => llamar('saveDraft', { config }), ok);
    if (r) await recargar();
    return !!r;
  };
}

function Resumen({ volver }: { volver: () => void }) {
  const { todo } = usePanel();
  const meses = useMemo(() => {
    const s = new Set(todo.pedidos.map((p) => p.fecha_alta.slice(0, 7)));
    s.add(new Date().toISOString().slice(0, 7));
    return [...s].sort().reverse();
  }, [todo.pedidos]);
  const [mes, setMes] = useState(meses[0]);
  const del = todo.pedidos.filter((p) => p.fecha_alta.startsWith(mes));
  const total = del.reduce((a, p) => a + p.total_ref, 0);
  const unidades = del.reduce((a, p) => a + p.items.reduce((b, x) => b + x.qty, 0), 0);
  const may = del.filter((p) => p.tipo === 'MAYORISTA');
  const top = Object.entries(del.flatMap((p) => p.items).reduce((m: Record<string, number>, x) => {
    const n = x.n.split(' · ')[0];
    m[n] = (m[n] || 0) + x.qty;
    return m;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const nombreMes = (m: string) => new Date(m + '-15').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return (
    <section className="sec">
      <Encabezado titulo="Resumen del negocio" volver={volver} texto="Con los pedidos cargados en el panel. Los montos son de referencia (precio publicado)." />
      <Campo label="Mes"><select value={mes} onChange={(e) => setMes(e.target.value)}>{meses.map((m) => <option key={m} value={m}>{cap(nombreMes(m))}</option>)}</select></Campo>
      <div className="stats stats-4">
        <div><b>{money(total)}</b><span>ventas</span></div>
        <div><b>{del.length}</b><span>{del.length === 1 ? 'pedido' : 'pedidos'}</span></div>
        <div><b>{unidades}</b><span>{unidades === 1 ? 'unidad' : 'unidades'}</span></div>
        <div><b>{del.length ? money(total / del.length) : '—'}</b><span>por pedido</span></div>
      </div>
      <div className="tarjeta">
        <h2>Minoristas y mayoristas</h2>
        <dl className="datos">
          <div><dt>Minoristas</dt><dd>{pedidosTxt(del.length - may.length)} · {money(total - may.reduce((a, p) => a + p.total_ref, 0))}</dd></div>
          <div><dt>Mayoristas</dt><dd>{pedidosTxt(may.length)} · {money(may.reduce((a, p) => a + p.total_ref, 0))}</dd></div>
        </dl>
      </div>
      <div className="tarjeta">
        <h2>Lo más pedido</h2>
        {top.length ? <ul className="items">{top.map(([n, q]) => <li key={n}><span>{n}</span><span>{q} u.</span></li>)}</ul> : <p className="ayuda">Sin pedidos este mes.</p>}
      </div>
      <div className="tarjeta">
        <h2>Ahora</h2>
        <dl className="datos">
          <div><dt>Pedidos en curso</dt><dd>{todo.pedidos.filter((p) => p.estado < 3).length}</dd></div>
          <div><dt>Esperan tu aviso</dt><dd>{todo.pedidos.filter(faltaAvisar).length}</dd></div>
          <div><dt>Clientes</dt><dd>{todo.clientes.length}</dd></div>
        </dl>
      </div>
    </section>
  );
}

function Mayoristas({ volver }: { volver: () => void }) {
  const { todo, ocupado, ir } = usePanel();
  const guardar = useGuardarConfig();
  const c = todo.config_draft;
  const [min, setMin] = useState(Number(c.ws_minimo) || 8);
  const [texto, setTexto] = useState(String(c.ws_texto || ''));
  const [envio, setEnvio] = useState(Number(c.envio_rafaela) || 0);
  const cambiado = min !== (Number(c.ws_minimo) || 8) || texto !== String(c.ws_texto || '') || envio !== (Number(c.envio_rafaela) || 0);
  const mayoristas = todo.clientes.filter((x) => x.tipo === 'MAYORISTA').map((x) => {
    const ps = todo.pedidos.filter((p) => p.cliente_id === x.id);
    return { ...x, pedidos: ps.length, unidades: ps.reduce((a, p) => a + p.items.reduce((b, i) => b + i.qty, 0), 0) };
  });
  return (
    <section className="sec">
      <Encabezado titulo="Mayoristas" volver={volver} texto="Condiciones que se ven en el portal mayorista y en las fichas." />
      <div className="tarjeta">
        <span className="campo-l">Mínimo de unidades</span>
        <div className="stepper">
          <button type="button" aria-label="Restar" onClick={() => setMin(Math.max(1, min - 1))}>−</button>
          <output>{min}</output>
          <button type="button" aria-label="Sumar" onClick={() => setMin(min + 1)}>+</button>
        </div>
        <Campo label="Texto de condiciones"><textarea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} /></Campo>
        <Campo label="Envío dentro de Rafaela" ayuda="Se usa en el carrito, en las preguntas frecuentes y en mayoristas.">
          <input inputMode="numeric" value={envio ? envio.toLocaleString('es-AR') : ''} onChange={(e) => setEnvio(Number(e.target.value.replace(/\D/g, '')) || 0)} />
        </Campo>
        <Boton tipo="pri" disabled={!cambiado || ocupado} onClick={() => guardar({ ws_minimo: String(min), ws_texto: texto, envio_rafaela: String(envio) })}>{ocupado ? 'Guardando…' : 'Guardar'}</Boton>
      </div>
      <div className="tarjeta">
        <h2>Clientes mayoristas</h2>
        {mayoristas.length ? (
          <ul className="items">{mayoristas.map((m) => <li key={m.id}><button type="button" className="hist" onClick={() => ir('clientes', { abrir: m.id })}>{m.nombre}</button><span>{m.pedidos} ped. · {m.unidades} u.</span></li>)}</ul>
        ) : <p className="ayuda">Todavía no hay clientes mayoristas.</p>}
        <Boton onClick={() => ir('clientes', { abrir: 'nuevo' })}>+ Nuevo mayorista</Boton>
      </div>
    </section>
  );
}

function Destacados({ volver }: { volver: () => void }) {
  const { todo, bor, ocupado } = usePanel();
  const guardar = useGuardarConfig();
  const inicial = json<string[]>(todo.config_draft.destacados, []);
  const [lista, setLista] = useState<string[]>(inicial);
  const [nuevo, setNuevo] = useState('');
  const opciones = bor.filter((p) => p.visible).flatMap((p) => (p.colores.length > 1 ? p.colores.map((c) => ({ k: `${p.slug}|${c.nombre}`, t: `${p.nombre} · ${cap(c.nombre)}` })) : [{ k: p.slug, t: p.nombre }]));
  const info = (k: string) => {
    const [slug, color] = k.split('|');
    const p = bor.find((x) => x.slug === slug);
    const c = p?.colores.find((x) => x.nombre === color) || p?.colores[0];
    return { t: p ? `${p.nombre}${color ? ' · ' + cap(color) : ''}` : 'Producto que ya no existe', url: c?.fotos[0]?.url, oculto: !p?.visible };
  };
  const mover = (i: number, d: number) => { const l = [...lista]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setLista(l); };
  return (
    <section className="sec">
      <Encabezado titulo="Destacados de la home" volver={volver} texto="Los productos de la sección «Destacados», en este orden. Conviene entre 8 y 15." />
      <ul className="lista">
        {lista.map((k, i) => { const x = info(k); return (
          <li key={k} className="dest">
            <span className="mini">{x.url ? <img src={x.url} alt="" loading="lazy" /> : null}</span>
            <span className="fila-txt"><span className="fila-n">{i + 1}. {x.t}</span>{x.oculto && <span className="fila-d alerta-t">Oculto en la web: no se va a ver</span>}</span>
            <span className="dest-b">
              <button type="button" aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" aria-label="Bajar" onClick={() => mover(i, 1)} disabled={i === lista.length - 1}>↓</button>
              <button type="button" aria-label="Quitar" onClick={() => setLista(lista.filter((_, j) => j !== i))}>×</button>
            </span>
          </li>
        ); })}
      </ul>
      <div className="tarjeta">
        <Campo label="Sumar un producto">
          <select value={nuevo} onChange={(e) => setNuevo(e.target.value)}><option value="">Elegí</option>{opciones.filter((o) => !lista.includes(o.k)).map((o) => <option key={o.k} value={o.k}>{o.t}</option>)}</select>
        </Campo>
        <Boton onClick={() => { if (nuevo) { setLista([...lista, nuevo]); setNuevo(''); } }} disabled={!nuevo}>+ Sumar a destacados</Boton>
      </div>
      {JSON.stringify(lista) !== JSON.stringify(inicial) && (
        <div className="acciones-fijas"><Boton tipo="pri" disabled={ocupado} onClick={() => guardar({ destacados: JSON.stringify(lista) })}>{ocupado ? 'Guardando…' : 'Guardar destacados'}</Boton></div>
      )}
    </section>
  );
}

function Aviso({ volver }: { volver: () => void }) {
  const { todo, ocupado } = usePanel();
  const guardar = useGuardarConfig();
  const c = todo.config_draft;
  const [activo, setActivo] = useState(bool(c.aviso_activo));
  const [texto, setTexto] = useState(String(c.aviso_texto || ''));
  const cambiado = activo !== bool(c.aviso_activo) || texto !== String(c.aviso_texto || '');
  return (
    <section className="sec">
      <Encabezado titulo="Aviso en la web" volver={volver} texto="Una franja dorada arriba de todas las páginas. Útil para vacaciones, feriados o novedades." />
      <div className="tarjeta">
        <label className="interruptor">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          <span className="int-v" aria-hidden="true" />
          <span>{activo ? 'Aviso prendido' : 'Aviso apagado'}</span>
        </label>
        <Campo label="Texto" ayuda={`${texto.length}/120 · Ej.: Del 20 al 27 de diciembre no hacemos envíos.`}>
          <input maxLength={120} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Campo>
        {activo && texto.trim() && <><span className="campo-l">Así se ve</span><div className="aviso-prev">{texto}</div></>}
        <Boton tipo="pri" disabled={!cambiado || ocupado || (activo && !texto.trim())} onClick={() => guardar({ aviso_activo: String(activo), aviso_texto: texto.trim() })}>{ocupado ? 'Guardando…' : 'Guardar'}</Boton>
      </div>
    </section>
  );
}

type Resena = { foto: string; alt: string };
const pedidosTxt = (n: number) => `${n} ${n === 1 ? 'pedido' : 'pedidos'}`;
const aBase64 = (b: Blob) => new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(b); });

function Resenas({ volver }: { volver: () => void }) {
  const { todo, fotos, ocupado, hacer, aviso } = usePanel();
  const guardar = useGuardarConfig();
  const inicial = json<Resena[]>(todo.config_draft.resenas, []);
  const [lista, setLista] = useState<Resena[]>(inicial);
  const [locales, setLocales] = useState<Record<string, string>>({});
  const [subiendo, setSubiendo] = useState(false);
  const url = (f: string) => locales[f] || urlFoto(f, fotos);
  async function subir(files: FileList | null) {
    if (!files?.length) return;
    setSubiendo(true);
    try {
      for (const f of Array.from(files)) {
        const r = await comprimirFoto(f);
        const s = await hacer(async () => llamar<{ fileId: string }>('uploadPhoto', { slug: 'resenas', base64: await aBase64(r.blob), mime: 'image/webp' }));
        if (!s) break;
        setLocales((l) => ({ ...l, [s.fileId]: r.url }));
        setLista((l) => [...l, { foto: s.fileId, alt: 'Cliente de Tactical Command con su compra' }]);
      }
      aviso('Fotos subidas. Guardá los cambios.');
    } finally { setSubiendo(false); }
  }
  const mover = (i: number, d: number) => { const l = [...lista]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setLista(l); };
  return (
    <section className="sec">
      <Encabezado titulo="Fotos de clientes" volver={volver} texto="Las fotos de «Garantía de satisfacción» en la home. Pedile permiso al cliente antes de subir su foto." />
      <div className="fotos">
        {lista.map((r, k) => (
          <figure key={r.foto} className="foto">
            <img src={url(r.foto)} alt={r.alt} />
            <div className="foto-b">
              <button type="button" aria-label="Mover a la izquierda" onClick={() => mover(k, -1)} disabled={k === 0}>‹</button>
              <button type="button" aria-label="Quitar foto" onClick={() => setLista(lista.filter((_, j) => j !== k))}>×</button>
              <button type="button" aria-label="Mover a la derecha" onClick={() => mover(k, 1)} disabled={k === lista.length - 1}>›</button>
            </div>
          </figure>
        ))}
        <label className="foto foto-mas">
          <input type="file" accept="image/*" multiple disabled={subiendo} onChange={(e) => { subir(e.target.files); e.target.value = ''; }} />
          <span>{subiendo ? 'Subiendo…' : '+ Foto'}</span>
        </label>
      </div>
      {JSON.stringify(lista) !== JSON.stringify(inicial) && (
        <div className="acciones-fijas"><Boton tipo="pri" disabled={ocupado || subiendo} onClick={() => guardar({ resenas: JSON.stringify(lista) })}>{ocupado ? 'Guardando…' : 'Guardar fotos'}</Boton></div>
      )}
    </section>
  );
}

function MiClave({ volver }: { volver: () => void }) {
  const { aviso } = usePanel();
  return (
    <section className="sec">
      <Encabezado titulo="Cambiar mi contraseña" volver={volver} texto="Al cambiarla se cierra tu sesión en los otros dispositivos." />
      <div className="tarjeta"><FormClave pedirActual listo={() => { aviso('Contraseña cambiada. Usala la próxima vez que entres.'); volver(); }} /></div>
    </section>
  );
}

function Pin({ volver }: { volver: () => void }) {
  const { hacer, ocupado } = usePanel();
  const [actual, setActual] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [otra, setOtra] = useState('');
  const [err, setErr] = useState('');
  async function cambiar() {
    if (!/^\d{6,12}$/.test(nuevo)) return setErr('El PIN nuevo tiene que tener entre 6 y 12 números.');
    if (nuevo !== otra) return setErr('Los dos PIN nuevos no coinciden.');
    setErr('');
    const s = await hacer(() => llamar<{ token: string; exp: number }>('changePin', { actual, nuevo }), 'PIN cambiado. Usalo la próxima vez que entres.');
    if (s) { guardarSesion(s); volver(); }
  }
  const campo = (v: string, f: (x: string) => void) => <input type="password" inputMode="numeric" maxLength={12} value={v} onChange={(e) => f(e.target.value.replace(/\D/g, ''))} />;
  return (
    <section className="sec">
      <Encabezado titulo="Cambiar el PIN" volver={volver} texto="Al cambiarlo se cierra la sesión en los otros dispositivos." />
      <div className="tarjeta">
        <Campo label="PIN actual">{campo(actual, setActual)}</Campo>
        <Campo label="PIN nuevo" ayuda="Entre 6 y 12 números.">{campo(nuevo, setNuevo)}</Campo>
        <Campo label="Repetí el PIN nuevo">{campo(otra, setOtra)}</Campo>
        {err && <p className="campo-err" role="alert">{err}</p>}
        <Boton tipo="pri" disabled={ocupado || !actual || !nuevo || !otra} onClick={cambiar}>{ocupado ? 'Guardando…' : 'Cambiar PIN'}</Boton>
      </div>
    </section>
  );
}
