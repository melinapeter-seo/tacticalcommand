// Panel de Tactical Command: entra con usuario y contraseña (o PIN, si todavía no hay usuarios), lee la planilla (getAll) y edita pedidos, clientes, productos, precios y
// ajustes de la web. Los productos, precios y ajustes van a borrador hasta «Revisar y publicar».
import { useEffect, useMemo, useRef, useState } from 'react';
import { cerrarSesion, entrar, llamar, sesion, SesionVencida } from './api';
import { faltaAvisar } from './datos';
import { aProductos, cambios, type FotosRepo, type Todo } from './modelo';
import { PanelCtx, Confirmacion, Toast, useToast, Icono, Boton } from './ui';
import { FormClave } from './Clave';
import Pedidos from './Pedidos';
import Clientes from './Clientes';
import Productos from './Productos';
import Precios from './Precios';
import Mas from './Mas';

const SECCIONES = [
  { k: 'pedidos', t: 'Pedidos' },
  { k: 'clientes', t: 'Clientes' },
  { k: 'productos', t: 'Productos' },
  { k: 'precios', t: 'Precios' },
  { k: 'mas', t: 'Más' },
];

export default function App() {
  const [logueado, setLogueado] = useState(() => !!sesion());
  const [todo, setTodo] = useState<Todo | null>(null);
  const [fotos, setFotos] = useState<FotosRepo>({});
  const [error, setError] = useState('');
  const [seccion, setSeccion] = useState('pedidos');
  const [destino, setDestino] = useState<Record<string, unknown>>({});
  const [ocupado, setOcupado] = useState(false);
  const [toast, setToast] = useToast();
  const [conf, setConf] = useState<{ titulo: string; texto?: string; si: string; peligro?: boolean } | null>(null);
  const [revisar, setRevisar] = useState(false);
  const [viejo, setViejo] = useState(false);
  const [, refrescar] = useState(0);
  const resolver = useRef<(v: boolean) => void>(() => {});

  const salir = (msg = '') => { cerrarSesion(); setTodo(null); setLogueado(false); if (msg) setToast(msg); };
  const recargar = async () => {
    try {
      const d = await llamar<Todo>('getAll');
      // Con un Apps Script anterior (sin fichas ni historial) el panel funciona igual y avisa que falta actualizarlo.
      setTodo({ ...d, fichas: d.fichas || [], fichas_draft: d.fichas_draft || [], versiones: d.versiones || {} });
      setViejo(!d.fichas_draft);
      setError('');
    }
    catch (e) { if (e instanceof SesionVencida) salir(e.message); else setError((e as Error).message); }
  };
  useEffect(() => {
    if (!logueado) return;
    recargar();
    fetch('/panel/fotos.json').then((r) => r.json()).then(setFotos).catch(() => {});
  }, [logueado]);

  const bor = useMemo(() => (todo ? aProductos(todo.productos_draft, todo.variantes_draft, todo.fichas_draft, fotos) : []), [todo, fotos]);
  const pub = useMemo(() => (todo ? aProductos(todo.productos, todo.variantes, todo.fichas, fotos) : []), [todo, fotos]);
  const pendientes = useMemo(() => (todo ? cambios(pub, bor, todo.config, todo.config_draft) : []), [pub, bor, todo]);

  if (!logueado) return <Login entrar={() => setLogueado(true)} />;
  if (sesion()?.cambiar) return <ClaveNueva listo={() => { refrescar((n) => n + 1); setToast('Contraseña guardada'); }} salir={() => salir()} />;
  if (!todo) return <div className="cargando">{error ? <><p>{error}</p><Boton onClick={recargar}>Probar de nuevo</Boton></> : 'Cargando los datos de la planilla…'}</div>;

  const sinAvisar = todo.pedidos.filter(faltaAvisar).length;
  const ctx = {
    todo, bor, pub, fotos, ocupado, destino, sitio: location.host,
    setTodo: (f: (d: Todo) => Todo) => setTodo((d) => (d ? f(d) : d)),
    recargar,
    aviso: setToast,
    confirmar: (o: { titulo: string; texto?: string; si: string; peligro?: boolean }) => new Promise<boolean>((r) => { resolver.current = r; setConf(o); }),
    ir: (s: string, extra: Record<string, unknown> = {}) => { setDestino(extra); setSeccion(s); scrollTo(0, 0); },
    hacer: async <T,>(fn: () => Promise<T>, ok?: string) => {
      setOcupado(true);
      try { const r = await fn(); if (ok) setToast(ok); return r; }
      catch (e) { if (e instanceof SesionVencida) salir(e.message); else setToast((e as Error).message); return undefined; }
      finally { setOcupado(false); }
    },
  };

  async function publicar() {
    const r = await ctx.hacer(() => llamar<{ build: string }>('publish'));
    if (!r) return;
    setRevisar(false);
    await recargar();
    setToast(r.build === 'sin DEPLOY_HOOK_URL' ? 'Publicado en la planilla, pero falta el Build Hook: la web no se actualiza.' : 'Publicado. La web se actualiza en 1 o 2 minutos.');
  }
  async function descartar() {
    if (!(await ctx.confirmar({ titulo: '¿Descartar los cambios sin publicar?', texto: 'Productos, precios y ajustes vuelven a quedar como están en la web.', si: 'Descartar cambios', peligro: true }))) return;
    if (await ctx.hacer(() => llamar('discardDraft'), 'Cambios descartados')) { setRevisar(false); await recargar(); }
  }

  return (
    <PanelCtx.Provider value={ctx}>
      <div className={`app ${pendientes.length ? 'con-barra' : ''}`}>
        <aside className="nav" aria-label="Secciones">
          <div className="marca">Tactical Command <span>Panel</span></div>
          {SECCIONES.map((s) => (
            <button key={s.k} type="button" className="nav-i" aria-current={seccion === s.k ? 'page' : undefined} onClick={() => ctx.ir(s.k)}>
              <Icono n={s.k} /><span>{s.t}</span>
              {s.k === 'pedidos' && sinAvisar > 0 && <b className="badge" aria-label={`${sinAvisar} sin avisar`}>{sinAvisar}</b>}
              {s.k === 'productos' && pendientes.length > 0 && <b className="badge badge-o" aria-label="Cambios sin publicar">•</b>}
            </button>
          ))}
          <div className={`estado-web ${pendientes.length ? 'pend' : ''}`}>{pendientes.length ? '● Cambios sin publicar' : '● Web al día'}</div>
        </aside>
        <main className="cont">
          {viejo && <div className="demo">Falta actualizar el código de la planilla para editar las fichas. Avisale a Melina.</div>}
          {seccion === 'pedidos' && <Pedidos />}
          {seccion === 'clientes' && <Clientes />}
          {seccion === 'productos' && <Productos />}
          {seccion === 'precios' && <Precios />}
          {seccion === 'mas' && <Mas salir={() => salir()} />}
        </main>
        {pendientes.length > 0 && (
          <div className="barra-bor" role="region" aria-label="Cambios sin publicar">
            <span><b>{pendientes.length} {pendientes.length === 1 ? 'cambio' : 'cambios'} sin publicar.</b><span className="barra-x"> La web sigue mostrando la versión anterior.</span></span>
            <div className="barra-b">
              <Boton tipo="txt" onClick={descartar} disabled={ocupado}>Descartar</Boton>
              <Boton tipo="pri" onClick={() => setRevisar(true)} disabled={ocupado}>Revisar y publicar</Boton>
            </div>
          </div>
        )}
      </div>
      {revisar && (
        <div className="modal-fondo" onClick={() => setRevisar(false)}>
          <div className="modal modal-g" role="dialog" aria-modal="true" aria-labelledby="rev-t" onClick={(e) => e.stopPropagation()}>
            <h2 id="rev-t">Revisá los cambios</h2>
            <p>Esto es lo que va a cambiar en la web. Se actualiza en 1 o 2 minutos.</p>
            <ul className="rev">{pendientes.map((c, i) => <li key={i}><b>{c.t}</b><ul>{c.w.map((w, j) => <li key={j}>{w}</li>)}</ul></li>)}</ul>
            <div className="modal-b">
              <Boton onClick={() => setRevisar(false)}>Volver</Boton>
              <Boton tipo="pri" onClick={publicar} disabled={ocupado}>{ocupado ? 'Publicando…' : 'Publicar en la web'}</Boton>
            </div>
          </div>
        </div>
      )}
      <Confirmacion o={conf} responder={(v) => { setConf(null); resolver.current(v); }} />
      <Toast texto={toast} />
    </PanelCtx.Provider>
  );
}

function Login({ entrar: listo }: { entrar: () => void }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    try { await entrar(usuario.trim(), clave); listo(); } catch (err) { setError((err as Error).message); setClave(''); } finally { setCargando(false); }
  }
  return (
    <div className="login">
      <form className="login-c" onSubmit={enviar}>
        <div className="marca">Tactical Command <span>Panel</span></div>
        <h1>Ingresá al panel</h1>
        <label className="campo"><span className="campo-l">Usuario</span>
          <input value={usuario} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => { setUsuario(e.target.value); setError(''); }} autoFocus />
        </label>
        <label className="campo"><span className="campo-l">Contraseña</span>
          <span className="clave-in">
            <input type={ver ? 'text' : 'password'} value={clave} autoComplete="current-password" aria-invalid={!!error} onChange={(e) => { setClave(e.target.value); setError(''); }} />
            <button type="button" className="clave-ver" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? 'Ocultar' : 'Ver'}</button>
          </span>
        </label>
        {error && <p className="campo-err" role="alert">{error}</p>}
        <Boton tipo="pri" type="submit" disabled={clave.length < 4 || cargando}>{cargando ? 'Entrando…' : 'Entrar'}</Boton>
        <p className="login-n">La sesión dura 12 horas en este dispositivo. ¿Te olvidaste la contraseña? Pedile a Melina que te la restablezca.</p>
      </form>
    </div>
  );
}

/** Primera vez con una contraseña temporal: hay que elegir una propia antes de seguir. */
function ClaveNueva({ listo, salir }: { listo: () => void; salir: () => void }) {
  const s = sesion();
  return (
    <div className="login">
      <div className="login-c">
        <div className="marca">Tactical Command <span>Panel</span></div>
        <h1>Hola{s?.nombre ? `, ${s.nombre}` : ''}</h1>
        <p className="ayuda">Estás entrando con una contraseña temporal. Elegí una propia: solo vos la vas a saber.</p>
        <FormClave listo={listo} />
        <Boton tipo="txt" onClick={salir}>Salir</Boton>
      </div>
    </div>
  );
}
