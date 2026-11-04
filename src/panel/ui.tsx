// Piezas comunes del panel: contexto, botones, campos, confirmación y aviso breve.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Producto } from './datos';
import type { FotosRepo, Todo } from './modelo';

export type Ir = (seccion: string, extra?: Record<string, unknown>) => void;
export type Ctx = {
  todo: Todo;
  /** Productos del borrador y de lo publicado, ya convertidos para el panel. */
  bor: Producto[];
  pub: Producto[];
  fotos: FotosRepo;
  setTodo: (f: (d: Todo) => Todo) => void;
  recargar: () => Promise<void>;
  /** Corre una llamada a la API con indicador de «guardando» y muestra el error si falla. */
  hacer: <T>(fn: () => Promise<T>, ok?: string) => Promise<T | undefined>;
  ocupado: boolean;
  aviso: (t: string) => void;
  confirmar: (o: { titulo: string; texto?: string; si: string; peligro?: boolean }) => Promise<boolean>;
  sitio: string;
  ir: Ir;
  destino: Record<string, unknown>;
};
export const PanelCtx = createContext<Ctx>(null!);
export const usePanel = () => useContext(PanelCtx);

export function Boton({ tipo = 'sec', children, ...p }: { tipo?: 'pri' | 'sec' | 'txt' | 'wa' | 'peligro'; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`b b-${tipo}`} {...p}>{children}</button>;
}

export function Campo({ label, ayuda, children, error }: { label: string; ayuda?: ReactNode; children: ReactNode; error?: string }) {
  return (
    <label className="campo">
      <span className="campo-l">{label}</span>
      {children}
      {error ? <span className="campo-err">{error}</span> : ayuda ? <span className="campo-a">{ayuda}</span> : null}
    </label>
  );
}

export function Encabezado({ titulo, texto, volver, accion }: { titulo: string; texto?: string; volver?: () => void; accion?: ReactNode }) {
  return (
    <header className="enc">
      {volver && <button type="button" className="volver" onClick={volver}>‹ Volver</button>}
      <div className="enc-f">
        <h1>{titulo}</h1>
        {accion}
      </div>
      {texto && <p className="enc-t">{texto}</p>}
    </header>
  );
}

export function Confirmacion({ o, responder }: { o: { titulo: string; texto?: string; si: string; peligro?: boolean } | null; responder: (v: boolean) => void }) {
  useEffect(() => {
    if (!o) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && responder(false);
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [o]);
  if (!o) return null;
  return (
    <div className="modal-fondo" onClick={() => responder(false)}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="m-t" onClick={(e) => e.stopPropagation()}>
        <h2 id="m-t">{o.titulo}</h2>
        {o.texto && <p>{o.texto}</p>}
        <div className="modal-b">
          <Boton onClick={() => responder(false)}>Cancelar</Boton>
          <Boton tipo={o.peligro ? 'peligro' : 'pri'} onClick={() => responder(true)} autoFocus>{o.si}</Boton>
        </div>
      </div>
    </div>
  );
}

export function Toast({ texto }: { texto: string }) {
  return texto ? <div className="toast" role="status">{texto}</div> : null;
}

export function useToast() {
  const [t, setT] = useState('');
  useEffect(() => { if (!t) return; const id = setTimeout(() => setT(''), 2400); return () => clearTimeout(id); }, [t]);
  return [t, setT] as const;
}

/** Íconos de trazo simple (24 px) para la barra de navegación. */
export function Icono({ n }: { n: string }) {
  const d: Record<string, ReactNode> = {
    pedidos: <><path d="M4 7h16M4 12h16M4 17h10" /></>,
    clientes: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" /></>,
    productos: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
    precios: <><path d="M12 3v18M16.5 7.5c-.7-1.4-2.4-2.2-4.5-2.2-2.6 0-4.3 1.3-4.3 3.2 0 4.4 9 2.4 9 6.8 0 2-1.9 3.4-4.7 3.4-2.3 0-4.2-.9-4.9-2.5" /></>,
    mas: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
    flecha: <path d="M9 6l6 6-6 6" />,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d[n]}</svg>;
}
