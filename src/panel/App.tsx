// Panel de Tactical Command. Versión navegable para aprobar el diseño: modo demostración con datos de ejemplo
// (los cambios viven solo en esta pestaña). La conexión con la planilla se suma en la versión final.
import { useEffect, useRef, useState } from 'react';
import type { Datos } from './datos';
import { faltaAvisar } from './datos';
import { PanelCtx, Confirmacion, Toast, useToast, Icono, Boton, Encabezado } from './ui';
import Pedidos from './Pedidos';
import Productos from './Productos';

const SECCIONES = [
  { k: 'pedidos', t: 'Pedidos' },
  { k: 'clientes', t: 'Clientes' },
  { k: 'productos', t: 'Productos' },
  { k: 'precios', t: 'Precios' },
  { k: 'mas', t: 'Más' },
];
const PIN_DEMO = '123456';

export default function App() {
  const [entro, setEntro] = useState(() => { try { return sessionStorage.getItem('tc-panel') === 'demo'; } catch { return false; } });
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [seccion, setSeccion] = useState('pedidos');
  const [toast, setToast] = useToast();
  const [conf, setConf] = useState<{ titulo: string; texto?: string; si: string; peligro?: boolean } | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});

  useEffect(() => {
    if (!entro || datos) return;
    fetch('/panel/demo.json').then((r) => r.json()).then(setDatos).catch(() => setError('No se pudieron cargar los datos. Probá recargar la página.'));
  }, [entro]);

  if (!entro) return <Login entrar={() => { try { sessionStorage.setItem('tc-panel', 'demo'); } catch {} setEntro(true); }} />;
  if (!datos) return <div className="cargando">{error || 'Cargando…'}</div>;

  const sinAvisar = datos.pedidos.filter(faltaAvisar).length;
  const ctx = {
    datos, sitio: location.host,
    setDatos: (f: (d: Datos) => Datos) => setDatos((d) => (d ? f(d) : d)),
    aviso: setToast,
    confirmar: (o: typeof conf & {}) => new Promise<boolean>((r) => { resolver.current = r; setConf(o); }),
  };

  return (
    <PanelCtx.Provider value={ctx}>
      <div className="app">
        <aside className="nav" aria-label="Secciones">
          <div className="marca">Tactical Command <span>Panel</span></div>
          {SECCIONES.map((s) => (
            <button key={s.k} type="button" className="nav-i" aria-current={seccion === s.k ? 'page' : undefined} onClick={() => { setSeccion(s.k); scrollTo(0, 0); }}>
              <Icono n={s.k} /><span>{s.t}</span>
              {s.k === 'pedidos' && sinAvisar > 0 && <b className="badge" aria-label={`${sinAvisar} sin avisar`}>{sinAvisar}</b>}
            </button>
          ))}
        </aside>
        <main className="cont">
          <div className="demo">Modo demostración: los cambios no se guardan.</div>
          {seccion === 'pedidos' && <Pedidos />}
          {seccion === 'productos' && <Productos />}
          {!['pedidos', 'productos'].includes(seccion) && (
            <section className="sec">
              <Encabezado titulo={SECCIONES.find((s) => s.k === seccion)!.t} texto="Esta sección se suma en la versión completa del panel. En esta versión podés revisar Pedidos y Productos." />
            </section>
          )}
        </main>
      </div>
      <Confirmacion o={conf} responder={(v) => { setConf(null); resolver.current(v); }} />
      <Toast texto={toast} />
    </PanelCtx.Provider>
  );
}

function Login({ entrar }: { entrar: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="login">
      <form className="login-c" onSubmit={(e) => { e.preventDefault(); if (pin === PIN_DEMO) entrar(); else setError('PIN incorrecto.'); }}>
        <div className="marca">Tactical Command <span>Panel</span></div>
        <h1>Ingresá tu PIN</h1>
        <input className="pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={12} value={pin} aria-label="PIN" aria-invalid={!!error}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }} autoFocus />
        {error && <p className="campo-err" role="alert">{error}</p>}
        <Boton tipo="pri" type="submit" disabled={pin.length < 4}>Entrar</Boton>
        <p className="login-n">Demostración: el PIN es <b>123456</b>.</p>
      </form>
    </div>
  );
}
