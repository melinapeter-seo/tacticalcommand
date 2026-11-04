// Pedidos: lista con búsqueda y filtros, detalle con pasos y aviso por WhatsApp, y alta en 3 pasos.
// Se guardan al instante en la planilla (no pasan por borrador).
import { useEffect, useMemo, useState } from 'react';
import type { Pedido, Item, Cliente } from './datos';
import { llamar } from './api';
import { FECHAS, LOCALES, cap, QUE_SIGUE, TRANSPORTES, avisado, digitos, faltaAvisar, fecha, fechaHora, linkWhatsApp, mensaje, money, nombrePaso } from './datos';
import { Boton, Campo, Encabezado, usePanel } from './ui';

const FILTROS = [
  { k: 'todos', t: 'Todos' },
  { k: 'avisar', t: 'Sin avisar' },
  { k: 'curso', t: 'En curso' },
  { k: 'entregados', t: 'Entregados' },
];

export default function Pedidos() {
  const { destino } = usePanel();
  const [abierto, setAbierto] = useState<string | null>((destino.abrir as string) || null);
  const [nuevo, setNuevo] = useState<Partial<Cliente> | null>((destino.nuevoPara as Cliente) || null);
  useEffect(() => { setAbierto((destino.abrir as string) || null); setNuevo((destino.nuevoPara as Cliente) || null); }, [destino]);
  if (nuevo) return <NuevoPedido para={nuevo} cerrar={(codigo) => { setNuevo(null); if (codigo) setAbierto(codigo); }} />;
  if (abierto) return <Detalle codigo={abierto} volver={() => setAbierto(null)} />;
  return <Lista abrir={setAbierto} crear={() => setNuevo({})} />;
}

function Estado({ p }: { p: Pedido }) {
  return <span className={`estado e${p.estado}`}>{nombrePaso(p, p.estado)}</span>;
}

function Lista({ abrir, crear }: { abrir: (c: string) => void; crear: () => void }) {
  const { todo: datos } = usePanel();
  const [q, setQ] = useState('');
  const [f, setF] = useState('todos');
  const sinAvisar = datos.pedidos.filter(faltaAvisar).length;
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase(), d = digitos(q);
    return datos.pedidos
      .filter((p) => !t || p.codigo.toLowerCase().includes(t) || p.nombre.toLowerCase().includes(t) || (d.length >= 3 && digitos(p.telefono).includes(d)))
      .filter((p) => f === 'todos' || (f === 'avisar' && faltaAvisar(p)) || (f === 'curso' && p.estado < 3) || (f === 'entregados' && p.estado === 3))
      .sort((a, b) => Number(a.estado === 3) - Number(b.estado === 3) || b.fecha_alta.localeCompare(a.fecha_alta));
  }, [datos.pedidos, q, f]);

  return (
    <section className="sec">
      <Encabezado titulo="Pedidos" texto="Cargá cada compra que confirmes por WhatsApp y avanzala a medida que la preparás y la enviás." accion={<Boton tipo="pri" onClick={crear}>+ Nuevo pedido</Boton>} />
      {sinAvisar > 0 && f !== 'avisar' && (
        <button type="button" className="alerta" onClick={() => setF('avisar')}>
          <b>{sinAvisar} {sinAvisar === 1 ? 'pedido espera' : 'pedidos esperan'} tu aviso al cliente</b><span>Ver →</span>
        </button>
      )}
      <input className="buscar" type="search" placeholder="Buscar por código, nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar pedidos" />
      <div className="chips" role="tablist">
        {FILTROS.map((x) => <button key={x.k} type="button" role="tab" aria-selected={f === x.k} className="chip" onClick={() => setF(x.k)}>{x.t}</button>)}
      </div>
      <ul className="lista">
        {lista.map((p) => (
          <li key={p.codigo}>
            <button type="button" className="fila" onClick={() => abrir(p.codigo)}>
              <span className="fila-a"><span className="cod">{p.codigo}</span><Estado p={p} /></span>
              <span className="fila-n">{p.nombre}{p.tipo === 'MAYORISTA' && <span className="tag">Mayorista</span>}</span>
              <span className="fila-d">{p.items[0]?.n}{p.items.length > 1 ? ` y ${p.items.length - 1} más` : ''}</span>
              <span className="fila-p">
                <span>{fecha(p.fecha_alta)} · {money(p.total_ref)}</span>
                {faltaAvisar(p) && <span className="falta">● Falta avisar</span>}
              </span>
            </button>
          </li>
        ))}
        {!lista.length && <li className="vacio">No hay pedidos con ese filtro.</li>}
      </ul>
    </section>
  );
}

function Detalle({ codigo, volver }: { codigo: string; volver: () => void }) {
  const { todo } = usePanel();
  const p = todo.pedidos.find((x) => x.codigo === codigo);
  if (!p) return <section className="sec"><Encabezado titulo="Pedido no encontrado" volver={volver} /></section>;
  return <DetallePedido p={p} volver={volver} />;
}

function DetallePedido({ p, volver }: { p: Pedido; volver: () => void }) {
  const { setTodo, hacer, confirmar, sitio, ocupado, ir, todo } = usePanel();
  const codigo = p.codigo;
  const [transporte, setTransporte] = useState(p.transporte || '');
  const [guia, setGuia] = useState(p.guia || '');
  const [err, setErr] = useState('');
  // Cada acción va a la planilla; con la respuesta se actualiza el pedido en pantalla.
  const aplicar = (nuevo?: Pedido) => { if (nuevo) setTodo((d) => ({ ...d, pedidos: d.pedidos.map((x) => (x.codigo === codigo ? nuevo : x)) })); };
  const sig = p.estado + 1;
  const local = LOCALES.includes(transporte);
  const pideTransporte = sig === 2;
  const msg = mensaje({ ...p }, p.estado, sitio);

  async function avanzar() {
    setErr('');
    if (pideTransporte && !transporte) return setErr('Elegí el transporte.');
    if (pideTransporte && !local && !guia.trim()) return setErr('Cargá el número de guía.');
    const prox = nombrePaso({ transporte }, sig);
    if (!(await confirmar({ titulo: `¿Pasar a «${prox}»?`, texto: 'Después vas a poder avisarle al cliente con el mensaje ya escrito.', si: `Sí, pasar a ${prox.toLowerCase()}` }))) return;
    aplicar(await hacer(() => llamar<Pedido>('advanceOrder', { code: codigo, ...(pideTransporte ? { transporte, guia: local ? '' : guia.trim() } : {}) }), `Pedido en «${prox}»`));
    scrollTo(0, 0);
  }
  async function deshacer() {
    if (!(await confirmar({ titulo: '¿Deshacer el último paso?', texto: `El pedido vuelve a «${nombrePaso(p, p.estado - 1)}».`, si: 'Deshacer', peligro: true }))) return;
    aplicar(await hacer(() => llamar<Pedido>('undoStep', { code: codigo }), 'Paso deshecho'));
  }
  async function eliminar() {
    if (!(await confirmar({ titulo: `¿Eliminar el pedido ${codigo}?`, texto: 'Se borra de la planilla y el código deja de funcionar en el seguimiento. No se puede deshacer.', si: 'Eliminar pedido', peligro: true }))) return;
    if (!(await hacer(() => llamar('deleteOrder', { code: codigo }), 'Pedido eliminado'))) return;
    setTodo((d) => ({ ...d, pedidos: d.pedidos.filter((x) => x.codigo !== codigo) }));
    volver();
  }
  const marcarAvisado = async () => aplicar(await hacer(() => llamar<Pedido>('markNotified', { code: codigo, stage: p.estado }), 'Marcado como avisado'));

  return (
    <section className="sec">
      <Encabezado titulo={p.nombre} volver={volver} />
      <div className="codigo-g">
        <span className="cod cod-g">{p.codigo}</span>
        <Boton tipo="txt" onClick={() => { navigator.clipboard?.writeText(p.codigo); hacer(async () => true, 'Código copiado'); }}>Copiar</Boton>
      </div>

      <div className="tarjeta">
        <ol className="pasos">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className={i < p.estado ? 'hecho' : i === p.estado ? 'actual' : ''}>
              <span className="paso-m" aria-hidden="true">{i < p.estado || (i === 3 && p.estado === 3) ? '✓' : i + 1}</span>
              <span className="paso-t">{nombrePaso(p, i)}</span>
              <span className="paso-f">{fechaHora(p[FECHAS[i]])}{i <= p.estado && <em className={avisado(p, i) ? 'ok' : 'no'}>{avisado(p, i) ? 'Avisado' : 'Sin avisar'}</em>}</span>
            </li>
          ))}
        </ol>
        <p className="sigue">{QUE_SIGUE[p.estado]}</p>
      </div>

      {faltaAvisar(p) && (
        <div className="tarjeta tarjeta-wa">
          <h2>Avisale al cliente</h2>
          <p className="ayuda">El mensaje ya está escrito. Se abre WhatsApp con el número de {p.nombre.split(' ')[0]}.</p>
          <pre className="msg">{msg}</pre>
          <a className="b b-wa" href={linkWhatsApp(p.telefono, msg)} target="_blank" rel="noopener" onClick={marcarAvisado}>Enviar por WhatsApp</a>
          <Boton tipo="txt" onClick={marcarAvisado} disabled={ocupado}>Ya le avisé de otra forma</Boton>
        </div>
      )}

      {p.estado < 3 && (
        <div className="tarjeta">
          {pideTransporte && (
            <>
              <Campo label="Transporte">
                <select value={transporte} onChange={(e) => setTransporte(e.target.value)}>
                  <option value="">Elegí cómo sale el pedido</option>
                  {TRANSPORTES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
                </select>
              </Campo>
              {transporte && !local && (
                <Campo label="Número de guía"><input value={guia} onChange={(e) => setGuia(e.target.value)} inputMode="text" autoComplete="off" /></Campo>
              )}
            </>
          )}
          {err && <p className="campo-err" role="alert">{err}</p>}
          <Boton tipo="pri" onClick={avanzar} disabled={ocupado}>{ocupado ? 'Guardando…' : `Pasar a «${nombrePaso({ transporte }, sig)}»`}</Boton>
        </div>
      )}

      {p.estado >= 2 && p.transporte && (
        <div className="tarjeta">
          <h2>Envío</h2>
          <dl className="datos"><div><dt>Transporte</dt><dd>{cap(p.transporte)}</dd></div>{p.guia && <div><dt>Guía</dt><dd className="cod">{p.guia}</dd></div>}</dl>
        </div>
      )}

      <div className="tarjeta">
        <h2>Qué compró</h2>
        <ul className="items">{p.items.map((it, i) => <li key={i}><span>{it.qty} × {it.n}</span><span>{money(it.qty * it.price)}</span></li>)}</ul>
        <div className="total"><span>Total de referencia</span><b>{money(p.total_ref)}</b></div>
      </div>

      <div className="tarjeta">
        <h2>Cliente {todo.clientes.some((c) => c.id === p.cliente_id) && <Boton tipo="txt" onClick={() => ir('clientes', { abrir: p.cliente_id })}>Ver ficha →</Boton>}</h2>
        <dl className="datos">
          <div><dt>WhatsApp</dt><dd>{p.telefono}</dd></div>
          <div><dt>Destino</dt><dd>{p.destino || '—'} · {p.entrega === 'SUCURSAL' ? 'a sucursal' : 'a domicilio'}</dd></div>
          <div><dt>Tipo</dt><dd>{p.tipo === 'MAYORISTA' ? 'Mayorista' : 'Minorista'}</dd></div>
        </dl>
        {p.nota && <p className="nota">{p.nota}</p>}
        <a className="b b-sec" href={linkWhatsApp(p.telefono, mensaje(p, 0, sitio))} target="_blank" rel="noopener">Reenviar el código por WhatsApp</a>
      </div>

      <div className="acciones-sec">
        {p.estado > 0 && <Boton tipo="txt" onClick={deshacer} disabled={ocupado}>↶ Deshacer el último paso</Boton>}
        <Boton tipo="txt" onClick={eliminar} disabled={ocupado}>Eliminar pedido</Boton>
      </div>
    </section>
  );
}

function NuevoPedido({ para, cerrar }: { para: Partial<Cliente>; cerrar: (codigo?: string) => void }) {
  const { todo, pub, setTodo, hacer, ocupado } = usePanel();
  const datos = { clientes: todo.clientes, productos: pub.filter((p) => p.visible), config: { ws_minimo: Number(todo.config.ws_minimo) || 8 } };
  const [cli, setCli] = useState({ nombre: para.nombre || '', telefono: para.telefono || '', destino: para.localidad || '', entrega: 'DOMICILIO', tipo: para.tipo || 'MINORISTA' });
  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState({ slug: '', color: '', talle: '', qty: 1 });
  const [nota, setNota] = useState('');
  const [err, setErr] = useState('');
  const prod = datos.productos.find((p) => p.slug === sel.slug);
  const color = prod?.colores.find((c) => c.nombre === sel.color) || prod?.colores[0];
  const talles = color ? [...color.talles, ...color.ninos.map((n) => `${n} (niños)`)] : [];
  const sugeridos = cli.nombre.trim().length >= 2 || digitos(cli.telefono).length >= 3
    ? datos.clientes.filter((c) => (cli.nombre.trim().length >= 2 && c.nombre.toLowerCase().includes(cli.nombre.trim().toLowerCase())) || (digitos(cli.telefono).length >= 3 && digitos(c.telefono).includes(digitos(cli.telefono)))).slice(0, 3)
    : [];
  const total = items.reduce((a, x) => a + x.qty * x.price, 0);
  const unidades = items.reduce((a, x) => a + x.qty, 0);

  function sumar() {
    if (!prod || !color) return;
    if (talles.length && !sel.talle) return setErr('Elegí el talle o número.');
    const precio = (sel.talle && color.precios_talle[sel.talle]) || color.precio || prod.precio;
    const n = `${prod.nombre}${prod.colores.length > 1 ? ' · ' + color.nombre.charAt(0) + color.nombre.slice(1).toLowerCase() : ''}${sel.talle ? (prod.categoria === 'CALZADO' ? ' · Nro ' : ' · Talle ') + sel.talle : ''}`;
    setItems([...items, { n, sku: color.sku, qty: Math.max(1, sel.qty), price: precio }]);
    setSel({ slug: '', color: '', talle: '', qty: 1 });
    setErr('');
  }
  async function guardar() {
    if (!cli.nombre.trim()) return setErr('Falta el nombre.');
    if (digitos(cli.telefono).length < 8) return setErr('El WhatsApp tiene que tener al menos 8 números.');
    if (!items.length) return setErr('Sumá al menos un producto.');
    setErr('');
    const r = await hacer(() => llamar<{ pedido: Pedido; cliente: Cliente }>('createOrder', {
      cliente: { nombre: cli.nombre.trim(), telefono: cli.telefono.trim(), localidad: cli.destino, tipo: cli.tipo },
      destino: cli.destino, entrega: cli.entrega, tipo: cli.tipo, items, nota,
    }));
    if (!r) return;
    setTodo((d) => ({ ...d, pedidos: [r.pedido, ...d.pedidos], clientes: d.clientes.some((c) => c.id === r.cliente.id) ? d.clientes : [...d.clientes, r.cliente] }));
    hacer(async () => true, `Pedido ${r.pedido.codigo} creado`);
    cerrar(r.pedido.codigo);
  }

  return (
    <section className="sec">
      <Encabezado titulo="Nuevo pedido" texto="Cargá una compra que ya confirmaste por WhatsApp. El código de seguimiento se genera solo." volver={() => cerrar()} />
      <div className="tarjeta">
        <h2><span className="num">1</span> ¿Quién compra?</h2>
        <Campo label="Nombre"><input value={cli.nombre} onChange={(e) => setCli({ ...cli, nombre: e.target.value })} autoComplete="off" /></Campo>
        <Campo label="WhatsApp" ayuda="Con código de área. Ej.: 3492 556677"><input value={cli.telefono} inputMode="tel" onChange={(e) => setCli({ ...cli, telefono: e.target.value })} autoComplete="off" /></Campo>
        {sugeridos.length > 0 && (
          <div className="sugeridos">
            <span className="campo-a">¿Es alguno de estos clientes?</span>
            {sugeridos.map((c) => (
              <button key={c.id} type="button" className="chip" onClick={() => setCli({ ...cli, nombre: c.nombre, telefono: c.telefono, destino: c.localidad, tipo: c.tipo })}>{c.nombre} · {c.telefono}</button>
            ))}
          </div>
        )}
        <Campo label="Localidad de destino"><input value={cli.destino} onChange={(e) => setCli({ ...cli, destino: e.target.value })} /></Campo>
        <div className="dos">
          <Campo label="Entrega"><select value={cli.entrega} onChange={(e) => setCli({ ...cli, entrega: e.target.value })}><option value="DOMICILIO">A domicilio</option><option value="SUCURSAL">A sucursal</option></select></Campo>
          <Campo label="Tipo"><select value={cli.tipo} onChange={(e) => setCli({ ...cli, tipo: e.target.value })}><option value="MINORISTA">Minorista</option><option value="MAYORISTA">Mayorista</option></select></Campo>
        </div>
      </div>

      <div className="tarjeta">
        <h2><span className="num">2</span> ¿Qué compra?</h2>
        <Campo label="Producto">
          <select value={sel.slug} onChange={(e) => setSel({ slug: e.target.value, color: '', talle: '', qty: 1 })}>
            <option value="">Elegí un producto</option>
            {datos.productos.map((p) => <option key={p.slug} value={p.slug}>{p.nombre}</option>)}
          </select>
        </Campo>
        {prod && prod.colores.length > 1 && (
          <Campo label="Color"><select value={color?.nombre} onChange={(e) => setSel({ ...sel, color: e.target.value, talle: '' })}>{prod.colores.map((c) => <option key={c.nombre}>{c.nombre}</option>)}</select></Campo>
        )}
        {prod && (
          <div className="dos">
            {talles.length > 0 && (
              <Campo label={prod.categoria === 'CALZADO' ? 'Número' : 'Talle'}>
                <select value={sel.talle} onChange={(e) => setSel({ ...sel, talle: e.target.value })}><option value="">Elegí</option>{talles.map((t) => <option key={t}>{t}</option>)}</select>
              </Campo>
            )}
            <Campo label="Cantidad"><input type="number" min={1} inputMode="numeric" value={sel.qty} onChange={(e) => setSel({ ...sel, qty: +e.target.value || 1 })} /></Campo>
          </div>
        )}
        {prod && <Boton onClick={sumar}>+ Sumar al pedido</Boton>}
        {items.length > 0 && (
          <>
            <ul className="items">{items.map((it, i) => <li key={i}><span>{it.qty} × {it.n}</span><span>{money(it.qty * it.price)} <button type="button" className="quitar" aria-label="Quitar" onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button></span></li>)}</ul>
            <div className="total"><span>Total de referencia</span><b>{money(total)}</b></div>
            {cli.tipo === 'MAYORISTA' && unidades < datos.config.ws_minimo && <p className="ayuda alerta-t">El mínimo mayorista es de {datos.config.ws_minimo} unidades (lleva {unidades}).</p>}
          </>
        )}
      </div>

      <div className="tarjeta">
        <h2><span className="num">3</span> Nota interna <span className="opc">(opcional)</span></h2>
        <Campo label="Solo la ves vos" ayuda="Ej.: paga por transferencia, retira el sábado."><textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} /></Campo>
      </div>

      {err && <p className="campo-err" role="alert">{err}</p>}
      <div className="acciones-fijas"><Boton tipo="pri" onClick={guardar} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar pedido'}</Boton></div>
    </section>
  );
}
