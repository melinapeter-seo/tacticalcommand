// Formulario de contraseña nueva: primera entrada con contraseña temporal y «Más › Cambiar mi contraseña».
import { useState } from 'react';
import { guardarSesion, llamar, type Sesion } from './api';
import { Boton } from './ui';

/** Cambio de contraseña (lo usan la primera entrada y «Más › Cambiar mi contraseña»). */
export function FormClave({ listo, pedirActual = false }: { listo: () => void; pedirActual?: boolean }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [otra, setOtra] = useState('');
  const [ver, setVer] = useState(false);
  const [err, setErr] = useState('');
  const [cargando, setCargando] = useState(false);
  const temporal = !pedirActual;
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (nueva.length < 8) return setErr('La contraseña tiene que tener al menos 8 caracteres.');
    if (nueva !== otra) return setErr('Las dos contraseñas nuevas no coinciden.');
    setErr(''); setCargando(true);
    try {
      // Con contraseña temporal, la actual es la que se acaba de usar para entrar: se pide igual, para confirmar.
      const s = await llamar<Sesion>('changePassword', { actual, nueva });
      guardarSesion(s); listo();
    } catch (x) { setErr((x as Error).message); } finally { setCargando(false); }
  }
  const tipo = ver ? 'text' : 'password';
  return (
    <form className="form-clave" onSubmit={guardar}>
      <label className="campo"><span className="campo-l">{temporal ? 'Contraseña temporal (la que te pasó Melina)' : 'Contraseña actual'}</span>
        <input type={tipo} value={actual} autoComplete="current-password" onChange={(e) => setActual(e.target.value)} /></label>
      <label className="campo"><span className="campo-l">Contraseña nueva</span>
        <input type={tipo} value={nueva} autoComplete="new-password" onChange={(e) => setNueva(e.target.value)} />
        <span className="campo-a">Al menos 8 caracteres. Puede tener letras, números y símbolos.</span></label>
      <label className="campo"><span className="campo-l">Repetí la contraseña nueva</span>
        <input type={tipo} value={otra} autoComplete="new-password" onChange={(e) => setOtra(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar contraseñas</label>
      {err && <p className="campo-err" role="alert">{err}</p>}
      <Boton tipo="pri" type="submit" disabled={cargando || !actual || !nueva || !otra}>{cargando ? 'Guardando…' : 'Guardar contraseña'}</Boton>
    </form>
  );
}
