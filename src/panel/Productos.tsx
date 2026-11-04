// Productos: lista y editor de ficha (datos, colores y fotos, ficha guiada, semáforo de calidad).
import { useMemo, useState } from 'react';
import type { Color, Ficha, Producto } from './datos';
import { CATEGORIAS, calidad, cap, comprimirFoto, linkWhatsApp, money } from './datos';
import { Boton, Campo, Encabezado, usePanel } from './ui';

const slugDe = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function Productos() {
  const [abierto, setAbierto] = useState<string | null>(null);
  if (abierto) return <Editor slug={abierto} volver={() => setAbierto(null)} />;
  return <Lista abrir={setAbierto} />;
}

function Semaforo({ p, chico }: { p: Producto; chico?: boolean }) {
  const c = calidad(p);
  if (chico) return <span className={`sem sem-${c.nivel}`} title={`Ficha ${c.n} de ${c.total}`}>{c.n}/{c.total}</span>;
  return (
    <div className={`tarjeta calidad sem-b-${c.nivel}`}>
      <h2>Calidad de la ficha <span className={`sem sem-${c.nivel}`}>{c.n} de {c.total}</span></h2>
      <p className="ayuda">{c.nivel === 'ok' ? 'La ficha está completa.' : 'Completar lo que falta ayuda a que el producto aparezca en Google y a que el cliente se decida.'}</p>
      <ul className="checks">{c.items.map((x) => <li key={x.t} className={x.ok ? 'ok' : ''}>{x.ok ? '✓' : '○'} {x.t}{!x.ok && x.falta ? ` (${x.falta})` : ''}</li>)}</ul>
    </div>
  );
}

function Lista({ abrir }: { abrir: (s: string) => void }) {
  const { datos, setDatos, aviso } = usePanel();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const lista = useMemo(() => datos.productos
    .filter((p) => (!cat || p.categoria === cat) && (!q.trim() || (p.nombre + ' ' + p.sku).toLowerCase().includes(q.trim().toLowerCase()))), [datos.productos, q, cat]);

  function crear() {
    const base = 'producto-nuevo';
    let slug = base, i = 2;
    while (datos.productos.some((p) => p.slug === slug)) slug = `${base}-${i++}`;
    const p: Producto = {
      slug, nombre: '', categoria: 'ACCESORIOS', subcategoria: '', sku: '', visible: false, precio: 50000, orden: 9999,
      ficha: { descripcion: '', descripcion_larga: [''], caracteristicas: [''], especificaciones: [{ k: '', v: '' }], faq: [{ q: '', a: '' }] },
      colores: [{ nombre: 'NEGRO', sku: '', muestra: '#17191A', fotos: [], talles: [], ninos: [], precio: null, precios_talle: {} }],
    };
    setDatos((d) => ({ ...d, productos: [p, ...d.productos] }));
    aviso('Producto nuevo (oculto hasta que lo publiques)');
    abrir(slug);
  }

  return (
    <section className="sec">
      <Encabezado titulo="Productos" texto="Editá nombre, fotos, colores, talles y la ficha de cada producto. Los cambios se ven en la web cuando los publicás." accion={<Boton tipo="pri" onClick={crear}>+ Nuevo producto</Boton>} />
      <input className="buscar" type="search" placeholder="Buscar por nombre o SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar productos" />
      <div className="chips">
        <button type="button" className="chip" aria-selected={!cat} onClick={() => setCat('')}>Todos</button>
        {CATEGORIAS.map((c) => <button key={c} type="button" className="chip" aria-selected={cat === c} onClick={() => setCat(c)}>{cap(c)}</button>)}
      </div>
      <ul className="lista lista-prod">
        {lista.map((p) => (
          <li key={p.slug}>
            <button type="button" className="fila fila-prod" onClick={() => abrir(p.slug)}>
              <span className="mini">{p.colores[0]?.fotos[0] ? <img src={p.colores[0].fotos[0].url} alt="" loading="lazy" /> : <span className="mini-v">Sin foto</span>}</span>
              <span className="fila-txt">
                <span className="fila-n">{p.nombre || 'Producto sin nombre'}</span>
                <span className="fila-d">{cap(p.categoria)} · {p.colores.length} {p.colores.length === 1 ? 'color' : 'colores'} · {money(p.precio)}</span>
                <span className="fila-p">{!p.visible && <span className="tag tag-o">Oculto</span>}<Semaforo p={p} chico /></span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Lista editable de textos (características, párrafos). */
function ListaTextos({ valores, cambiar, placeholder, multilinea, agregar }: { valores: string[]; cambiar: (v: string[]) => void; placeholder: string; multilinea?: boolean; agregar: string }) {
  return (
    <div className="lt">
      {valores.map((v, i) => (
        <div key={i} className="lt-f">
          {multilinea
            ? <textarea rows={4} value={v} placeholder={placeholder} onChange={(e) => cambiar(valores.map((x, j) => (j === i ? e.target.value : x)))} />
            : <input value={v} placeholder={placeholder} onChange={(e) => cambiar(valores.map((x, j) => (j === i ? e.target.value : x)))} />}
          <button type="button" className="quitar" aria-label="Quitar" onClick={() => cambiar(valores.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <Boton tipo="txt" onClick={() => cambiar([...valores, ''])}>{agregar}</Boton>
    </div>
  );
}

function Editor({ slug, volver }: { slug: string; volver: () => void }) {
  const { datos, setDatos, aviso, confirmar } = usePanel();
  const original = datos.productos.find((p) => p.slug === slug)!;
  const [p, setP] = useState<Producto>(() => structuredClone(original));
  const [abiertoColor, setAbiertoColor] = useState(0);
  const [nuevaSub, setNuevaSub] = useState(false);
  const cambiado = JSON.stringify(p) !== JSON.stringify(original);
  const subcats = [...new Set(datos.productos.filter((x) => x.categoria === p.categoria).map((x) => x.subcategoria).filter(Boolean))];
  const ejemplo = datos.productos.find((x) => x.categoria === p.categoria && x.slug !== p.slug && calidad(x).nivel === 'ok');
  const calzado = p.categoria === 'CALZADO';
  const set = (c: Partial<Producto>) => setP({ ...p, ...c });
  const setFicha = (c: Partial<Ficha>) => setP({ ...p, ficha: { ...p.ficha, ...c } });
  const setColor = (i: number, c: Partial<Color>) => setP({ ...p, colores: p.colores.map((x, j) => (j === i ? { ...x, ...c } : x)) });

  function guardar() {
    if (!p.nombre.trim()) return aviso('Falta el nombre del producto');
    const final = { ...p, slug: p.slug.startsWith('producto-nuevo') && p.nombre.trim() ? slugDe(p.nombre) : p.slug };
    setDatos((d) => ({ ...d, productos: d.productos.map((x) => (x.slug === slug ? final : x)) }));
    aviso('Guardado. Queda en «Cambios sin publicar».');
  }
  async function salir() {
    if (cambiado && !(await confirmar({ titulo: '¿Salir sin guardar?', texto: 'Los cambios de esta ficha se pierden.', si: 'Salir sin guardar', peligro: true }))) return;
    volver();
  }
  async function subirFotos(i: number, files: FileList | null) {
    if (!files?.length) return;
    const nuevas = [], chicas: string[] = [];
    for (const f of Array.from(files)) {
      const r = await comprimirFoto(f);
      nuevas.push({ id: 'nueva-' + Math.random().toString(36).slice(2), url: r.url });
      if (r.chica) chicas.push(f.name);
    }
    setColor(i, { fotos: [...p.colores[i].fotos, ...nuevas] });
    aviso(chicas.length ? `Fotos agregadas. Ojo: ${chicas.length === 1 ? 'una es chica' : chicas.length + ' son chicas'} (menos de 1200 px).` : `${nuevas.length === 1 ? 'Foto agregada' : nuevas.length + ' fotos agregadas'}`);
  }
  const mover = (i: number, k: number, d: number) => {
    const f = [...p.colores[i].fotos];
    const j = k + d;
    if (j < 0 || j >= f.length) return;
    [f[k], f[j]] = [f[j], f[k]];
    setColor(i, { fotos: f });
  };
  const pedirMelina = () => {
    const txt = `Hola Melina! Walter acá. ¿Me armás la ficha de "${p.nombre || 'un producto nuevo'}"?\nCategoría: ${cap(p.categoria)}${p.subcategoria ? ' / ' + cap(p.subcategoria) : ''}\nColores: ${p.colores.map((c) => cap(c.nombre)).join(', ')}\nQuedó en el panel como borrador.`;
    window.open(linkWhatsApp(datos.config.soporte_whatsapp, txt), '_blank', 'noopener');
  };

  return (
    <section className="sec sec-editor">
      <Encabezado titulo={p.nombre || 'Producto nuevo'} volver={salir} />
      <label className="interruptor">
        <input type="checkbox" checked={p.visible} onChange={(e) => set({ visible: e.target.checked })} />
        <span className="int-v" aria-hidden="true" />
        <span>{p.visible ? 'Visible en la web' : 'Oculto en la web'}</span>
      </label>

      <div className="tarjeta tarjeta-ayuda">
        <h2>¿Preferís que la arme Melina?</h2>
        <p className="ayuda">Cargá lo básico (nombre, fotos, colores) y mandale un aviso. El producto queda oculto hasta que se publique.</p>
        <Boton onClick={pedirMelina}>Pedirle a Melina que la arme</Boton>
      </div>
      <Semaforo p={p} />

      <div className="tarjeta">
        <h2><span className="num">1</span> Datos básicos</h2>
        <Campo label="Nombre" ayuda="Así se ve en la web. Ej.: Borcego Táctico Ranger Negro"><input value={p.nombre} onChange={(e) => set({ nombre: e.target.value })} /></Campo>
        <div className="dos">
          <Campo label="Categoría"><select value={p.categoria} onChange={(e) => set({ categoria: e.target.value, subcategoria: '' })}>{CATEGORIAS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select></Campo>
          <Campo label="Subcategoría">
            {nuevaSub
              ? <input autoFocus placeholder="Nombre de la subcategoría nueva" value={p.subcategoria} onChange={(e) => set({ subcategoria: e.target.value.toUpperCase() })} />
              : (
                <select value={p.subcategoria} onChange={(e) => (e.target.value === '__nueva' ? (setNuevaSub(true), set({ subcategoria: '' })) : set({ subcategoria: e.target.value }))}>
                  <option value="">Elegí</option>
                  {subcats.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                  <option value="__nueva">+ Crear una nueva…</option>
                </select>
              )}
          </Campo>
        </div>
        <div className="dos">
          <Campo label="SKU"><input value={p.sku} onChange={(e) => set({ sku: e.target.value.toUpperCase() })} autoComplete="off" /></Campo>
          <Campo label="Precio" ayuda="Se puede ajustar por color o talle en Precios."><input inputMode="numeric" value={p.precio ? p.precio.toLocaleString('es-AR') : ''} onChange={(e) => set({ precio: +e.target.value.replace(/\D/g, '') || 0 })} /></Campo>
        </div>
      </div>

      <div className="tarjeta">
        <h2><span className="num">2</span> Colores, fotos y {calzado ? 'números' : 'talles'}</h2>
        {p.colores.map((c, i) => (
          <div key={i} className={`color ${abiertoColor === i ? 'abierto' : ''}`}>
            <button type="button" className="color-h" onClick={() => setAbiertoColor(abiertoColor === i ? -1 : i)} aria-expanded={abiertoColor === i}>
              <span className="sw" style={{ background: c.muestra }} />
              <span className="color-n">{cap(c.nombre) || 'Color sin nombre'}</span>
              <span className="color-d">{c.fotos.length} fotos · {c.talles.length + c.ninos.length || 'sin'} {calzado ? 'números' : 'talles'}</span>
            </button>
            {abiertoColor === i && (
              <div className="color-c">
                <div className="dos">
                  <Campo label="Nombre del color"><input value={c.nombre} onChange={(e) => setColor(i, { nombre: e.target.value.toUpperCase() })} /></Campo>
                  <Campo label="Muestra"><input type="color" value={c.muestra} onChange={(e) => setColor(i, { muestra: e.target.value })} /></Campo>
                </div>
                <span className="campo-l">Fotos <span className="opc">La primera es la principal</span></span>
                <div className="fotos">
                  {c.fotos.map((f, k) => (
                    <figure key={f.id} className="foto">
                      <img src={f.url} alt={`Foto ${k + 1}`} />
                      {k === 0 && <figcaption>Principal</figcaption>}
                      <div className="foto-b">
                        <button type="button" aria-label="Mover a la izquierda" onClick={() => mover(i, k, -1)} disabled={k === 0}>‹</button>
                        <button type="button" aria-label="Quitar foto" onClick={() => setColor(i, { fotos: c.fotos.filter((_, j) => j !== k) })}>×</button>
                        <button type="button" aria-label="Mover a la derecha" onClick={() => mover(i, k, 1)} disabled={k === c.fotos.length - 1}>›</button>
                      </div>
                    </figure>
                  ))}
                  <label className="foto foto-mas">
                    <input type="file" accept="image/*" multiple onChange={(e) => { subirFotos(i, e.target.files); e.target.value = ''; }} />
                    <span>+ Foto</span>
                  </label>
                </div>
                <Campo label={calzado ? 'Números de adulto' : 'Talles'} ayuda={calzado ? 'Separados por coma. Ej.: 38, 39, 40' : 'Separados por coma. Ej.: S, M, L, XL. Vacío si no tiene talles.'}>
                  <input value={c.talles.join(', ')} onChange={(e) => setColor(i, { talles: e.target.value.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean) })} />
                </Campo>
                {calzado && (
                  <Campo label="Números de niños" ayuda="Se muestran en una fila aparte. Vacío si no hay.">
                    <input value={c.ninos.join(', ')} onChange={(e) => setColor(i, { ninos: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
                  </Campo>
                )}
                {p.colores.length > 1 && <Boton tipo="txt" onClick={async () => { if (await confirmar({ titulo: `¿Quitar el color ${cap(c.nombre)}?`, si: 'Quitar color', peligro: true })) { setP({ ...p, colores: p.colores.filter((_, j) => j !== i) }); setAbiertoColor(-1); } }}>Quitar este color</Boton>}
              </div>
            )}
          </div>
        ))}
        <Boton onClick={() => { setP({ ...p, colores: [...p.colores, { nombre: '', sku: p.sku, muestra: '#2F3530', fotos: [], talles: p.colores[0]?.talles || [], ninos: [], precio: null, precios_talle: {} }] }); setAbiertoColor(p.colores.length); }}>+ Agregar color</Boton>
      </div>

      <div className="tarjeta">
        <h2><span className="num">3</span> La ficha</h2>
        {ejemplo && <p className="ayuda">Como ejemplo, mirá la ficha de <a href={`/productos/${ejemplo.slug}/`} target="_blank" rel="noopener">{ejemplo.nombre}</a>.</p>}
        <Campo label="Descripción corta" ayuda={<span className={p.ficha.descripcion.length < 120 ? 'alerta-t' : ''}>{p.ficha.descripcion.length} caracteres · Conviene 120 o más. La primera frase tiene que decir qué es el producto.</span>}>
          <textarea rows={4} value={p.ficha.descripcion} onChange={(e) => setFicha({ descripcion: e.target.value })} />
        </Campo>
        <span className="campo-l">Descripción larga <span className="opc">Un párrafo por cuadro</span></span>
        <ListaTextos valores={p.ficha.descripcion_larga} cambiar={(v) => setFicha({ descripcion_larga: v })} placeholder="Contá para qué sirve, cómo está hecho y para quién es." multilinea agregar="+ Agregar párrafo" />
        <span className="campo-l">Características destacadas <span className="opc">Frases cortas</span></span>
        <ListaTextos valores={p.ficha.caracteristicas} cambiar={(v) => setFicha({ caracteristicas: v })} placeholder={ejemplo?.ficha.caracteristicas[0] || 'Ej.: Cierre lateral'} agregar="+ Agregar característica" />
        <span className="campo-l">Especificaciones</span>
        <div className="specs">
          {p.ficha.especificaciones.map((s, i) => (
            <div key={i} className="spec">
              <input aria-label="Dato" placeholder="Dato (ej.: MATERIAL)" value={s.k} onChange={(e) => setFicha({ especificaciones: p.ficha.especificaciones.map((x, j) => (j === i ? { ...x, k: e.target.value.toUpperCase() } : x)) })} />
              <input aria-label="Valor" placeholder="Valor (ej.: Cordura)" value={s.v} onChange={(e) => setFicha({ especificaciones: p.ficha.especificaciones.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)) })} />
              <button type="button" className="quitar" aria-label="Quitar" onClick={() => setFicha({ especificaciones: p.ficha.especificaciones.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          <Boton tipo="txt" onClick={() => setFicha({ especificaciones: [...p.ficha.especificaciones, { k: '', v: '' }] })}>+ Agregar especificación</Boton>
        </div>
        <span className="campo-l">Preguntas frecuentes</span>
        {p.ficha.faq.map((f, i) => (
          <div key={i} className="faq-e">
            <input placeholder="Pregunta (ej.: ¿Es impermeable?)" value={f.q} onChange={(e) => setFicha({ faq: p.ficha.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
            <textarea rows={2} placeholder="Respuesta" value={f.a} onChange={(e) => setFicha({ faq: p.ficha.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
            <Boton tipo="txt" onClick={() => setFicha({ faq: p.ficha.faq.filter((_, j) => j !== i) })}>Quitar pregunta</Boton>
          </div>
        ))}
        <Boton tipo="txt" onClick={() => setFicha({ faq: [...p.ficha.faq, { q: '', a: '' }] })}>+ Agregar pregunta</Boton>
      </div>

      {cambiado && (
        <div className="acciones-fijas">
          <Boton tipo="pri" onClick={guardar}>Guardar cambios</Boton>
        </div>
      )}
    </section>
  );
}
