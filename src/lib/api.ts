/**
 * URL de la API (Apps Script) normalizada. Corrige los errores típicos al copiarla:
 * el `/u/N/` de la sesión de Google (desde un servidor da 404) y lo que venga después de `/exec`.
 */
export const limpiarApi = (v: string | undefined) =>
  (v || '').trim().replace(/\/macros\/u\/\d+\//, '/macros/').replace(/(\/exec)[/?#].*$/, '$1');
export const API = limpiarApi(import.meta.env.PUBLIC_TC_API);
