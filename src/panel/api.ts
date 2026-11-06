// Conexión con la API (Apps Script). Los POST van como text/plain porque Apps Script no atiende el preflight de CORS.
import { API } from '../lib/api';

const CLAVE = 'tc-panel-sesion';
/** usuario vacío = se entró con el PIN (todavía no hay usuarios creados). cambiar = contraseña temporal. */
export type Sesion = { token: string; exp: number; usuario?: string; nombre?: string; cambiar?: boolean };

export function sesion(): Sesion | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE) || 'null') as Sesion | null;
    return s && s.exp > Date.now() ? s : null;
  } catch { return null; }
}
export const guardarSesion = (s: Sesion) => { try { sessionStorage.setItem(CLAVE, JSON.stringify(s)); } catch { /* sin storage */ } };
export const cerrarSesion = () => { try { sessionStorage.removeItem(CLAVE); } catch { /* sin storage */ } };

export class SesionVencida extends Error {}

export async function llamar<T = any>(action: string, cuerpo: Record<string, unknown> = {}): Promise<T> {
  if (!API) throw new Error('El panel no tiene configurada la dirección de la planilla (PUBLIC_TC_API).');
  const token = sesion()?.token;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60000);
  let r: Response;
  try {
    r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token, ...cuerpo }), signal: ctl.signal });
  } catch {
    throw new Error('No hay conexión con la planilla. Revisá internet y probá de nuevo.');
  } finally { clearTimeout(t); }
  const d = await r.json().catch(() => ({ ok: false, error: 'Respuesta inválida de la planilla.' }));
  if (!d.ok) {
    if (/Sesión inválida|sesión venció/i.test(d.error)) { cerrarSesion(); throw new SesionVencida(d.error); }
    throw new Error(d.error || 'Algo salió mal.');
  }
  return d.data as T;
}

// Se manda también `pin` con la contraseña: así funciona con un Apps Script sin usuarios (o anterior a ellos),
// donde se entra dejando el usuario vacío y poniendo el PIN.
export async function entrar(usuario: string, clave: string) {
  const s = await llamar<Sesion>('login', { usuario, clave, pin: clave });
  guardarSesion(s);
  return s;
}
