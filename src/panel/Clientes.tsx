// Clientes: lista con búsqueda y filtro minorista/mayorista, ficha editable, historial y accesos a WhatsApp y nuevo pedido.
// Se guardan al instante en la planilla.
import { useEffect, useMemo, useState } from 'react';
import type { Cliente } from './datos';
import { digitos, fecha, linkWhatsApp, money, nombrePaso } from './datos';
import { llamar } from './api';
import { Boton, Campo, Encabezado, usePanel } from './ui';

const FILTROS = [{ k: '', t: 'Todos' }, { k: 'MINORISTA', t: 'Minoristas' }, { k: 'MAYORISTA', t: 'Mayoristas' }];

export default function Clientes() {
  const { destino } = usePanel();
  const [abierto, setAbierto] = useState<string | null>((destino.abrir as string) || null);
  useEffect(() => { setAbierto((destino.abrir as string) || null); }, [destino]);
  if (abierto) return <Ficha id={abierto} volver={() => setAbierto(null)} />;
  return <Lista abrir={setAbierto} />;
}

function Lista({ abrir }: { abrir: (id: string) => void }) {
  const { todo } = usePanel();
  const [q, setQ] = useState('');
  const [f, setF] = useState('');
  const stats = useMemo(() => {
    const m: Record<string, { pedidos: number; ultima: string }> = {};
    for (const p of todo.pedidos) {
      const s = (m[p.cliente_id] ||= { pedidos: 0, ultima: '' });
      s.pedidos++;
      if (p.fecha_alta > s.ultima) s.ultima = p.fecha_alta;
    }
    return m;
  }, [todo.pedidos]);
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase(), d = digitos(q);
    return todo.clientes
      .filter((c) => !f || c.tipo === f)
      .filter((c) => !t || c.nombre.toLowerCase().includes(t) || c.localidad.toLowerCase().includes(t) || (d.length >= 3 && digitos(c.telefono).includes(d)))
      .sort((a, b) => (stats[b.id]?.ultima || b.alta).localeCompare(stats[a.id]?.ultima || a.alta));
  }, [todo.clientes, q, f, stats]);

  return (
    <section className="sec">
      <Encabezado titulo="Clientes" texto="Todos los que te compraron. Se crean solos al cargar un pedido con un WhatsApp nuevo." accion={<Boton tipo="pri" onClick={() => abrir('nuevo')}>+ Nuevo cliente</Boton>} />
      <input className="buscar" type="search" placeholder="Buscar por nombre, teléfono o localidad" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar clientes" />
      <div className="chips" role="tablist">
        {FILTROS.map((x) => <button key={x.k} type="button" role="tab" className="chip" aria-selected={f === x.k} onClick={() => setF(x.k)}>{x.t}</button>)}
      </div>
      <ul className="lista">
        {lista.map((c) => (
          <li key={c.id}>
            <button type="button" className="fila" onClick={() => abrir(c.id)}>
              <span className="fila-n">{c.nombre}{c.tipo === 'MAYORISTA' && <span className="tag">Mayorista</span>}</span>
              <span className="fila-d">{c.telefono}{c.localidad ? ` · ${c.localidad}` : ''}</span>
              <span className="fila-p"><span>{stats[c.id]?.pedidos || 0} {stats[c.id]?.pedidos === 1 ? 'pedido' : 'pedidos'}</span>{stats[c.id] && <span>Última compra: {fecha(stats[c.id].ultima)}</span>}</span>
            </button>
          </li>
        ))}
        {!lista.length && <li className="vacio">No hay clientes con ese filtro.</li>}
      </ul>
    </section>
  );
}

function Ficha({ id, volver }: { id: string; volver: () => void }) {
  const { todo, setTodo, hacer, ocupado, ir, confirmar } = usePanel();
  const nuevo = id === 'nuevo';
  const original = todo.clientes.find((c) => c.id === id);
  const vacio: Cliente = { id: '', nombre: '', telefono: '', localidad: '', tipo: 'MINORISTA', cuit: '', nota: '', alta: '' };
  const [c, setC] = useState<Cliente>(original || vacio);
  const [err, setErr] = useState('');
  const pedidos = todo.pedidos.filter((p) => p.cliente_id === id).sort((a, b) => b.fecha_alta.localeCompare(a.fecha_alta));
  const unidades = pedidos.reduce((a, p) => a + p.items.reduce((b, x) => b + x.qty, 0), 0);
  const cambiado = JSON.stringify(c) !== JSON.stringify(original || vacio);
  if (!nuevo && !original) return <section className="sec"><Encabezado titulo="Cliente no encontrado" volver={volver} /></section>;

  async function guardar() {
    if (!c.nombre.trim()) return setErr('Falta el nombre.');
    if (digitos(c.telefono).length < 8) return setErr('El WhatsApp tiene que tener al menos 8 números.');
    setErr('');
    const r = await hacer(() => llamar<Cliente>(nuevo ? 'createClient' : 'upsertClient', { cliente: c }), nuevo ? 'Cliente creado' : 'Guardado');
    if (!r) return;
    setTodo((d) => ({ ...d, clientes: nuevo ? [...d.clientes, r] : d.clientes.map((x) => (x.id === r.id ? r : x)) }));
    if (nuevo) volver(); else setC(r);
  }
  async function salir() {
    if (cambiado && !(await confirmar({ titulo: '¿Salir sin guardar?', si: 'Salir sin guardar', peligro: true }))) return;
    volver();
  }

  return (
    <section className="sec">
      <Encabezado titulo={nuevo ? 'Nuevo cliente' : c.nombre || 'Cliente'} volver={salir} />
      {!nuevo && (
        <div className="stats">
          <div><b>{pedidos.length}</b><span>{pedidos.length === 1 ? 'pedido' : 'pedidos'}</span></div>
          <div><b>{unidades}</b><span>{unidades === 1 ? 'unidad' : 'unidades'}</span></div>
          <div><b>{pedidos[0] ? fecha(pedidos[0].fecha_alta) : '—'}</b><span>última compra</span></div>
        </div>
      )}
      <div className="tarjeta">
        <Campo label="Nombre"><input value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} /></Campo>
        <Campo label="WhatsApp" ayuda="Con código de área. Ej.: 3492 556677"><input inputMode="tel" value={c.telefono} onChange={(e) => setC({ ...c, telefono: e.target.value })} /></Campo>
        <Campo label="Localidad"><input value={c.localidad} onChange={(e) => setC({ ...c, localidad: e.target.value })} /></Campo>
        <Campo label="Tipo">
          <select value={c.tipo} onChange={(e) => setC({ ...c, tipo: e.target.value })}><option value="MINORISTA">Minorista</option><option value="MAYORISTA">Mayorista</option></select>
        </Campo>
        {c.tipo === 'MAYORISTA' && <Campo label="CUIT"><input inputMode="numeric" value={c.cuit} onChange={(e) => setC({ ...c, cuit: e.target.value })} /></Campo>}
        <Campo label="Nota interna" ayuda="Solo la ves vos."><textarea rows={3} value={c.nota} onChange={(e) => setC({ ...c, nota: e.target.value })} /></Campo>
        {err && <p className="campo-err" role="alert">{err}</p>}
        {(nuevo || cambiado) && <Boton tipo="pri" onClick={guardar} disabled={ocupado}>{ocupado ? 'Guardando…' : nuevo ? 'Crear cliente' : 'Guardar cambios'}</Boton>}
      </div>
      {!nuevo && (
        <>
          <div className="dos dos-b">
            <a className="b b-wa" href={linkWhatsApp(c.telefono, `Hola ${c.nombre.split(' ')[0]}!`)} target="_blank" rel="noopener">Escribir por WhatsApp</a>
            <Boton onClick={() => ir('pedidos', { nuevoPara: c })}>+ Nuevo pedido</Boton>
          </div>
          <div className="tarjeta">
            <h2>Historial</h2>
            {pedidos.length ? (
              <ul className="items">
                {pedidos.map((p) => (
                  <li key={p.codigo}>
                    <button type="button" className="hist" onClick={() => ir('pedidos', { abrir: p.codigo })}>
                      <span><span className="cod">{p.codigo}</span> · {fecha(p.fecha_alta)}</span>
                      <span className={`estado e${p.estado}`}>{nombrePaso(p, p.estado)}</span>
                    </button>
                    <span>{money(p.total_ref)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="ayuda">Todavía no tiene pedidos.</p>}
          </div>
        </>
      )}
    </section>
  );
}
