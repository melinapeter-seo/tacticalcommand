// Conexión con la API (Apps Script). Los POST van como text/plain porque Apps Script no atiende el preflight de CORS.
import { API } from '../lib/api';

const CLAVE = 'tc-panel-sesion';
type Sesion = { token: string; exp: number };

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

export async function entrar(pin: string) {
  const s = await llamar<Sesion>('login', { pin });
  guardarSesion(s);
  return s;
}
