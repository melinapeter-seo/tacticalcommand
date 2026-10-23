# Handoff: Tactical Command — Web + Panel de gestión conectados a Google Sheets

## Overview
Tactical Command es una tienda de equipamiento táctico de Rafaela, Santa Fe, Argentina. Vende minorista y mayorista; **el checkout no tiene pago online: deriva a WhatsApp**. Este paquete contiene:

1. **Web pública** (`web/`): home, 4 landings de categoría (Equipos Tácticos, Indumentaria, Calzado, Accesorios), ~16 fichas de producto con variantes, flujo mayorista, página “Seguí tu pedido”, páginas legales, blog. Optimizada para SEO/AEO (FAQ, specs, datos estructurados).
2. **Panel de gestión** (`panel/`): uso exclusivo del dueño (Walter), desde celular y computadora. 5 pestañas: Pedidos, Clientes, Precios, Productos, Mayoristas.

**Objetivo de la implementación:** que la web y el panel compartan una única fuente de datos en **Google Sheets**. Lo que Walter publique desde el panel tiene que aparecer en la web sin tocar código.

## About the Design Files
Los archivos `.dc.html` son **referencias de diseño hechas en HTML**: prototipos que muestran el aspecto y el comportamiento esperados. **No son código de producción para copiar tal cual.** Abren directo en un navegador (dependen de `support.js`, que viene al lado).

La tarea es **recrearlos en un stack real**. No hay codebase previa. **Stack definido por el cliente:**
- **Web:** **Astro** (SSG). Las fichas tienen que ser **HTML estático con datos estructurados** (SEO/AEO), regenerado en cada publicación. Usar `astro:assets` para optimizar las fotos.
- **Repositorio:** **GitHub**.
- **Hosting:** **Netlify**, con deploy automático en cada push y un **Build Hook** que dispara Apps Script al publicar. `_redirects` de Netlify para las rutas viejas.
- **Panel:** una isla React dentro del mismo proyecto Astro en `/panel` (`noindex`, fuera del sitemap).
- **Backend:** Google Apps Script publicado como Web App sobre la planilla.
- **Fotos:** **Google Drive** (decisión del cliente). Ver "Fotos en Google Drive".

En los prototipos todo el estado vive en `localStorage`. Hay que reemplazarlo por llamadas a la API.

## Fidelity
**High-fidelity.** Colores, tipografía, espaciados, copy e interacciones son finales. Recrear con fidelidad visual. El copy de las fichas está revisado: no agregar afirmaciones que no estén en los datos (por ejemplo, “impermeable” solo donde ya figura).

---

## Arquitectura objetivo

```
 Panel (Walter) ──POST acciones──▶ Apps Script Web App ◀──GET catálogo── Build de la web (estático)
        ▲                                │      │                         ▲
        │                                ▼      └──GET pedido (en vivo)── Página “Seguí tu pedido”
        └────────── lectura ─────── Google Sheets                           (fetch desde el navegador)
                                         │
                 “Publicar” ──▶ Deploy hook del hosting (Netlify/Vercel/Cloudflare) ──▶ rebuild 1–2 min
 Fotos ──▶ Google Drive (WebP) ──▶ la planilla guarda el ID ──▶ el build las descarga y optimiza
```

- **Catálogo (productos, precios, disponibilidad, condiciones mayoristas):** se lee **en el build**. Al publicar, Apps Script dispara el deploy hook y la web se regenera.
- **Pedidos:** se consultan **en vivo**. La página de seguimiento llama a la API y no requiere rebuild.
- **Borrador/publicado:** el panel edita las hojas `*_draft`. “Publicar” copia draft → publicado y dispara el rebuild.

---

## Google Sheets — estructura exacta
Una sola planilla, propiedad de la cuenta de Google de Walter. La primera fila de cada hoja es el encabezado (snake_case).

### `productos` (publicado) y `productos_draft` (borrador): mismas columnas
| columna | tipo | ejemplo | notas |
|---|---|---|---|
| slug | texto, único | `cinto-tactico-cobra` | URL `/productos/{slug}/` |
| nombre | texto | Cinto Táctico Cobra | |
| categoria | enum | `ACCESORIOS` | `EQUIPOS TÁCTICOS`, `INDUMENTARIA`, `CALZADO`, `ACCESORIOS` |
| subcategoria | texto | Cinturones tácticos | |
| sku | texto | TC-CIN-COB | SKU base |
| descripcion | texto largo | … | primera frase = respuesta AEO |
| visible | bool | TRUE | FALSE = no se genera la página ni aparece en listados |
| precio | entero ARS | 50000 | precio de lista |
| talles | texto CSV | `S,M,L,XL,2XL,3XL` | vacío = sin talles |
| orden | entero | 10 | orden en la landing |
| actualizado | fecha ISO | | |

El contenido largo de cada ficha que hoy está en `PDPS` (long, keys, func, uses, specs, qa, related, dims, guide) puede ir en una hoja `fichas_contenido` (slug + campo + JSON) o quedar en archivos Markdown/JSON del repo. **El panel v1 solo edita los campos de la tabla de arriba y los de variantes.**

### `variantes` y `variantes_draft`
| columna | tipo | ejemplo | notas |
|---|---|---|---|
| slug | texto | cinto-tactico-cobra | FK → productos |
| idx | entero | 0 | orden de la variante |
| nombre | texto | NEGRO | se muestra en el selector y se usa en `?color=` |
| sku | texto | TC-CIN-COB-NG | |
| swatch | hex | #17191A | |
| fotos | texto | `url1\|url2\|url3` | la primera es la principal |
| precio | entero o vacío | | vacío = usa el precio de lista |
| precios_talle | JSON | `{"4XL":55000}` | sobreescribe por talle |
| agotados | texto CSV | `S,3XL` | talles agotados (productos con talles) |
| agotado | bool | FALSE | variante agotada (productos sin talles) |

**Precio efectivo** = `precios_talle[talle]` ?? `variante.precio` ?? `producto.precio`.

### `config` y `config_draft` (clave / valor)
| clave | valor por defecto |
|---|---|
| ws_minimo | 8 |
| ws_envio | A cargo del comprador · se cotiza por WhatsApp |
| ws_texto | Pedido mínimo de 8 unidades, combinables entre productos, colores y talles. El precio final y el costo de envío se confirman por WhatsApp. |
| ultima_publicacion | fecha ISO |

### `pedidos`
| columna | ejemplo | notas |
|---|---|---|
| codigo | TC-2610-7KQ4 | `TC-{AAMM}-{4 chars}` con alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, único |
| fecha_alta | ISO | |
| cliente_id | c1 | FK → clientes |
| nombre | Martín Gómez | copia al momento del pedido |
| telefono | 3492 556677 | |
| items | JSON | `[{"n":"Cinto Táctico Cobra · Negro","sku":"TC-CIN-COB-NG","qty":1,"price":50000}]` |
| destino | Córdoba Capital | |
| entrega | DOMICILIO / SUCURSAL | |
| tipo | MINORISTA / MAYORISTA | |
| estado | 0–3 | 0 Compra confirmada · 1 Preparación · 2 Despachado desde Rafaela · 3 Entregado |
| f_confirmado, f_preparacion, f_despacho, f_entrega | ISO | se completan al avanzar |
| avisado_0 … avisado_3 | bool | si Walter avisó al cliente de ese paso |
| transporte | ANDREANI / OCA / CORREO ARGENTINO / VÍA CARGO / OTRO | obligatorio al pasar a 2 |
| guia | texto | obligatorio al pasar a 2 |
| total_ref | entero | suma de items (referencia, no es factura) |
| nota | texto | interna, nunca se expone |

### `clientes`
`id, nombre, telefono, localidad, tipo (MINORISTA/MAYORISTA), cuit, nota, alta`.
Se identifica por los últimos 10 dígitos del teléfono. Al crear un pedido con un teléfono nuevo, se crea el cliente automáticamente.

---

## API — Google Apps Script Web App
Un `doGet` y un `doPost` que despachan por `action`. Respuestas JSON `{ok:true, data}` / `{ok:false, error}`.

**Públicas (sin clave):**
- `GET ?action=catalog` → productos visibles + variantes + config, **solo publicados**. Lo usa el build de la web.
- `GET ?action=track&code=TC-XXXX-XXXX&tel4=1234` → valida que los últimos 4 dígitos del teléfono coincidan. Devuelve **solo** `{codigo, estado, fechas[4], transporte, guia}`. Nunca nombre, items ni nota. Rate-limit básico con `CacheService` por IP/código.

**Privadas (header o campo `token`, guardado en `PropertiesService`; el panel lo obtiene con `action=login&pin=…`):**
- `login` → valida el PIN (guardado en Script Properties, **no en el código del panel**) y devuelve un token con vencimiento.
- `getAll` → draft + publicado + pedidos + clientes (para el panel).
- `saveDraft` → `{productos, variantes, config}` reemplaza las hojas `*_draft`.
- `publish` → copia `*_draft` → publicadas, guarda `ultima_publicacion` y hace `UrlFetchApp.fetch(DEPLOY_HOOK_URL, {method:'post'})`.
- `discardDraft` → copia publicadas → `*_draft`.
- `createOrder`, `advanceOrder {code, carrier?, guia?}`, `undoStep {code}`, `setGuia`, `markNotified {code, stage}`.
- `upsertClient`, `createClient`.
- `uploadPhoto {slug, idx, base64}` → el panel comprime en el navegador a WebP de hasta 1600 px antes de subir; Apps Script guarda en Drive `TC/fotos/{slug}/` y devuelve el **fileId**.
- `arrepentimiento` (pública) → guarda la solicitud en la hoja `arrepentimientos` (código, fecha/hora, nombre, email, teléfono, nº de pedido, motivo) y envía la constancia por mail con `MailApp` al cliente y a Walter. Hoy el prototipo la guarda en `localStorage`: reemplazar.

Usar `LockService` en las escrituras para evitar choques si Walter usa dos dispositivos.

---

## Screens / Views

### Design tokens (ambos)
- Fondo `#1A1D1B` · superficie `#222623` · superficie profunda `#151816` · panel alterno `#1C201D`
- Borde `#2F3530` · borde suave `#232825` · borde apagado `#3E453E`
- Texto `#E8EAE6` · secundario `#C3C8C1` · apagado `#9AA09A` · tenue `#7E887E` · placeholder `#5E665E`
- Dorado (acción/acento) `#E3B23C` · hover `#F5D470` · fondo dorado tenue `#221F16` / `#1F1D16` · borde dorado tenue `#3A3524`
- Error/atención `#E8B4A0` · OK `#7FB37F` (borde `#4A5D4B`, fondo `#1E2A1F`) · WhatsApp `#25D366` (hover `#4BE283`)
- Colores de estado de pedido: Confirmado `#C3C8C1` · Preparación `#8FB3D9` · Despachado `#E3B23C` · Entregado `#7FB37F`
- Tipografía: **Inter Tight** 400/500/600/700 (texto y títulos) · **IBM Plex Mono** 400/500 (etiquetas, códigos, botones; MAYÚSCULAS con letter-spacing .08–.22em, 9–13px). La web suma fuentes stencil para el hero (ver `<helmet>` de `web/`).
- Radio: **0** (todo recto). Sin sombras en el panel. La web usa un brillo dorado en los CTA principales (gradiente + `box-shadow` dorado: ver la web).
- Espaciado: múltiplos de 2. Padding de cards 14–20px, gaps 6/8/10/12/14/18/22px. Contenedor del panel `max-width:1320px`, padding lateral `clamp(16px,3vw,28px)`.

### Panel: comportamiento global
- **Login con PIN** (pantalla centrada, card de 380px). Sesión en `sessionStorage`.
- **Header sticky** (60px, `#151816`): “TC PANEL”, tabs centradas (desktop ≥900px) con subrayado dorado de 2px en la activa y badge (rojo claro = pedidos sin avisar; dorado = cambios sin publicar), e indicador “WEB AL DÍA” (verde) o “BORRADOR” (dorado).
- **Mobile <900px:** tabs en una **barra inferior fija** de 62px con 5 columnas (glifo + etiqueta de 9px). Las vistas lista/detalle se alternan, con “← VOLVER A LA LISTA”.
- **Encabezado de pestaña:** eyebrow dorado, H1 (26–38px), descripción, botón “? CÓMO FUNCIONA” (despliega 3 pasos numerados) y CTA dorado (“+ NUEVO PEDIDO” / “+ NUEVO CLIENTE” / “+ NUEVO PRODUCTO”).
- **Barra de borrador** (fija abajo, fondo `#221F16`, borde superior dorado), visible si hay diferencias entre draft y publicado: “● N CAMBIOS SIN PUBLICAR · La web sigue mostrando la versión anterior hasta que publiques.” Botones: DESCARTAR (confirmación) y REVISAR Y PUBLICAR → (abre un modal con la lista de cambios por producto, del tipo “Precio de lista: $ 50.000 → $ 54.000”; botón “PUBLICAR EN LA WEB”).
- **Modal de confirmación** genérico para toda acción que afecta al cliente o es destructiva (avanzar paso, deshacer, quitar variante, eliminar producto, ajuste masivo, descartar).
- **Toast** inferior centrado (fondo `#E8EAE6`, texto oscuro, mono 11px), 2,2 s.
- **Pedidos y clientes se guardan al instante.** Precios, productos y condiciones mayoristas van a **borrador**.

### Pestaña Pedidos
- Lista (izquierda, 300–380px): banner “● N PEDIDOS SIN AVISAR AL CLIENTE →” (filtra), buscador (código, nombre, teléfono) y filtros TODOS / SIN AVISAR / CONFIRMADO / PREPARACIÓN / DESPACHADO / ENTREGADO con contador. Items con código mono, fecha, nombre, primer producto, chip de estado de color, chip MAYORISTA y “● FALTA AVISAR”. Los entregados van al final.
- **Nuevo pedido** en 3 pasos numerados:
  1. ¿Quién compra? Nombre, WhatsApp, sugerencias de clientes existentes (al tocarla completa los datos), destino, DOMICILIO/SUCURSAL, MINORISTA/MAYORISTA.
  2. ¿Qué compra? Selects de producto → variante → talle (marcan “(agotado)”), cantidad y “+ SUMAR”. Lista con subtotales y un total de referencia. Aviso si es mayorista y no llega al mínimo.
  3. Nota interna.
  Validación: nombre, WhatsApp de al menos 8 dígitos y 1 ítem como mínimo. Al guardar se genera el código, se crea el cliente si no existe y se abre el detalle.
- **Detalle:** código grande dorado y “COPIAR CÓDIGO”; card **QUÉ SIGUE** (texto guía según el estado); stepper de 4 pasos con fecha y AVISADO / SIN AVISAR; card de transporte y guía con link al transporte; card “FALTA AVISAR AL CLIENTE · MENSAJE LISTO” con el texto prellenado, botón verde “ENVIAR POR WHATSAPP →” (`https://wa.me/549XXXXXXXXXX?text=…`) que también marca avisado, y “YA LE AVISÉ DE OTRA FORMA”. Al pasar de Preparación a Despachado se piden **transporte y guía** (obligatorios). Botón dorado “MARCAR: {siguiente paso} →” con confirmación y “↶ DESHACER ÚLTIMO PASO”. Debajo: datos del cliente (el nombre lleva a la ficha del cliente), ítems y total, nota, “REENVIAR CÓDIGO POR WHATSAPP” y “COPIAR FILA PARA SHEETS” (eliminar al conectar la API).
- Mensajes de WhatsApp: ver el método `msg()` en el panel. El link del sitio es `tacticalcommand.com.ar/envios` (**placeholder: reemplazar por el dominio real**).

### Pestaña Clientes
Lista con buscador y filtros TODOS / MINORISTAS / MAYORISTAS. Detalle editable con autosave: nombre, WhatsApp, localidad, tipo, CUIT (solo mayorista) y nota. Botones “ESCRIBIR POR WHATSAPP” y “+ NUEVO PEDIDO PARA ESTE CLIENTE” (precarga el formulario). Stats: pedidos, unidades, última compra. Historial clickeable (abre el pedido).

### Pestaña Precios
Buscador, filtros por categoría y botón “% AJUSTE MASIVO”. Tabla con foto de 56px, nombre, SKU · categoría, input de precio formateado `es-AR` y botón “VARIANTES”. Si cambió, borde izquierdo dorado y “Publicado: $ X”. Al expandir, cada variante muestra su input de precio (placeholder “Lista (50.000)”) y una grilla de talles con su input (vacío = hereda).
**Ajuste masivo:** 1) alcance (todos o categoría), 2) subir/bajar y %, 3) redondeo (sin / a $100 / a $1.000 / termina en 900), 4) vista previa antes → después. “APLICAR AL BORRADOR” (con confirmación) también ajusta los precios por variante y por talle.

### Pestaña Productos
Lista con foto, nombre, cantidad de variantes · categoría, y chips OCULTO / N AGOTADOS / ● SIN PUBLICAR. El editor tiene un toggle “VISIBLE / OCULTO EN LA WEB” y 3 secciones numeradas:
1. Datos básicos: nombre, categoría, subcategoría, SKU base, talles (CSV, se aplica al salir del campo).
2. Descripción, con contador. En rojo claro si tiene menos de 120 caracteres, con ayuda AEO.
3. Variantes: color (input color), nombre, SKU y QUITAR; fotos de 84px (la primera dice PRINCIPAL; ← → para reordenar, × para quitar, “+ FOTO” con selección múltiple); disponibilidad: chips por talle (verde = disponible, tachado = agotado) o DISPONIBLE/AGOTADO si no tiene talles.
Al final: “ELIMINAR PRODUCTO” (sugiere ocultar en su lugar).

### Pestaña Mayoristas
Izquierda, **Condiciones** (borrador): mínimo de unidades con −/+, aviso de envío, texto de condiciones y vista previa “ASÍ LO VE EL CLIENTE EN CADA FICHA”. Derecha: clientes mayoristas con unidades y pedidos (lleva a Clientes) y “+ NUEVO MAYORISTA”.

### Web: puntos que cambian con la integración
- `PDPS`, `PROD`, `CATS` y `TC_PRICE_TEMP` hoy están escritos en el código. Pasan a generarse desde `GET catalog` en el build.
- **Landings:** una ficha con varias variantes puede generar varias tarjetas de vista previa, cada una con `?color={variante}` (ej.: Cinto Cobra → Negro, Coyote, Verde Oliva; Sombrero → Woodland, Multicam; Shemagh → 3 colores; Uniforme → 3 opciones de tela). Regla sugerida: una tarjeta por variante en productos de accesorios, uniformes y mochilas; a definir con el cliente.
- **Ficha:** precio efectivo según variante y talle; talles agotados deshabilitados; variante agotada con “SIN STOCK” y botón de WhatsApp “Consultar reposición”. El mensaje de WhatsApp incluye producto, variante, talle, SKU y cantidad (ya implementado en el prototipo).
- **Mayorista:** mínimo y textos salen de `config`. La barra con el total acumulado ya existe en el prototipo.
- **“Seguí tu pedido”** (`#/envios/`): sumar el campo “Últimos 4 dígitos de tu teléfono”, llamar a `track` y renderizar el stepper con datos reales. El texto de ayuda pasa a ser “Lo recibiste por WhatsApp al confirmar tu compra”.
- **Schema.org:** `Product` + `Offer` (precio, `priceCurrency: ARS`, `availability` InStock/OutOfStock según las variantes) y `FAQPage` por ficha, regenerados en cada build.

---

## Orden de trabajo sugerido
0. **Regenerar `data/catalog.json` desde `PDPS`/`PROD` de `web/Tactical Command v2.dc.html`.** El HTML es la fuente de verdad: tiene ajustes de copy y fotos posteriores al JSON (ej.: textos de “verano” en Bajo Chaleco Manga Corta Multicam). Comparar y quedarse con lo del HTML.
1. Crear la planilla con las hojas y columnas de arriba. Cargarla con `panel/panel-seed.js` (16 productos con variantes, SKU y fotos) más un script de importación.
2. Apps Script: `catalog`, `track`, `login` y las acciones de escritura. Publicar como Web App (ejecutar como el dueño, acceso “cualquiera”). PIN, token secret y `DEPLOY_HOOK_URL` van en Script Properties.
3. Fotos: subir `web/uploads/TC/*.webp` a Drive y guardar los fileId en `variantes.fotos`.
4. Web: Astro (SSG), con fichas, landings y blog generados desde `catalog`. Repo en GitHub, deploy en Netlify y crear el Build Hook.
5. Panel: recrear la UI y reemplazar `localStorage` por la API. Mantener la separación borrador/publicado.
6. Conectar “Seguí tu pedido” a `track`.
7. QA en celular real (Walter usa ambos dispositivos), con mensajes de WhatsApp reales a un número de prueba.

## Datos pendientes (confirmar con el cliente)
- **Precios reales.** Hoy todo está en $50.000 de placeholder, salvo la Campera Gore-Tex en $189.900.
- **SKU definitivos.** Los actuales son provisorios.
- Dominio real, transportes que usan y PIN de Walter.
- Si el Uniforme Marpat existe en gabardina; si los Pantalones Cargo Negro y Woodland son el mismo modelo.
- Tablas de medidas por talle y reseñas reales (para schema `Review`).
- **URLs reales para SEO/AEO:** reemplazar las rutas hash (`#/productos/…`) por rutas reales (`/productos/cinto-tactico-cobra/`, `/accesorios/`, etc.) con redirects si hiciera falta.
- **Email:** usar `info@tacticalcommand.com.ar` en lugar del Gmail actual.
- **Logos de marcas en fotos** (Oakley, 5.11, Camelbak, Condor): quitarlos si los productos no son originales autorizados.
- Link de TikTok (lo agrega el cliente). QR de Data Fiscal y dirección exacta: fuera de esta etapa. Horario y redes: tomarlos del prototipo.
- **Transportes:** confirmar la lista (hoy: Andreani, OCA, Correo Argentino, Vía Cargo).

## Assets
- `web/uploads/TC/`: fotos de producto en WebP (reales, del cliente), imágenes de categoría, videos del hero (`hero-*.webm/mp4`), escudo `escudo-tc-wm.png` y fuente `gunplay-rg.otf`.
- `web/uploads/`: favicon, íconos sociales dorados, fuente `Stencil Regular S.otf` e imagen de fondo.
- La Gafa Sport todavía usa imágenes placeholder (rayadas) hasta tener fotos.

## Files
- `web/Tactical Command v2.dc.html`: web completa (todas las rutas son hash: `#/`, `#/accesorios/`, `#/productos/{slug}/?color=…`, `#/mayoristas/`, `#/envios/`, etc.). La lógica y los datos (`PDPS`, `PROD`, `CATS`) están en el `<script>` del final.
- `panel/Panel Tactical Command.dc.html`: panel. Toda la lógica está en la clase `Component` (diff borrador/publicado, ajuste masivo, mensajes de WhatsApp, generación de código).
- `panel/panel-seed.js`: catálogo extraído de la web (`window.TC_SEED`), útil como semilla de la planilla.
- `*/support.js`: runtime necesario solo para abrir los prototipos en el navegador. No forma parte de la implementación.


## Stock y disponibilidad

Decisión con Walter: el stock **siempre se verifica por WhatsApp** una vez derivado el carrito (ahí también se coordina envío y forma de pago).

- El front **no muestra** estado de stock: ningún producto ni talle aparece como agotado, "últimas unidades" o "bajo pedido". Todo se presenta como disponible.
- En el código se conservan los campos de stock para uso interno / futura conexión con Sheets: `av` en cada producto (`PROD`) y `ok`, `off`, `req`, `spec` en cada color de `PDPS[slug].colors[]`.
- No renderizar esos campos en la UI. Los 4XL y 5XL de la Campera Gore-Tex (solo Negro y Verde OD) son talles normales, igual que el resto. `spec` queda disponible para talles que se quieran marcar como "especial / consultar" en el futuro.


## Fuente única del catálogo (`data/catalog.json`)

En los prototipos el catálogo está repetido en tres estructuras dentro de `web/Tactical Command v2.dc.html`: `PROD` (tarjetas de listados), `PDPS` (fichas) y `WS` (mayorista, ya derivado de `PDPS`). **En la implementación real eso se reemplaza por una sola fuente**: `data/catalog.json` (16 productos, generado desde el prototipo actual). Tarjetas, fichas, filtros, buscador y mayorista se derivan de ahí. Después el JSON se reemplaza por la lectura de las hojas de Google Sheets con la misma forma.

**Estructura de cada producto**
- Identificación: `slug` (URL `/productos/{slug}/`), `nombre`, `categoria`, `subcategoria`, `sku`.
- Precios: `precio_minorista`, `precio_transferencia`. `precio_provisorio: true` marca los $50.000 de relleno; hay que cargar los reales.
- Textos: `descripcion`, `descripcion_larga`, `caracteristicas`, `usos`, `especificaciones`, `faq`, `relacionados` (slugs), `guia`.
- `opciones`: `con_talles`, `es_calzado`, `es_indumentaria`, `consulta_whatsapp_talle`.
- `colores[]`: una entrada por color, con `nombre`, `sku`, `muestra` (hex), `fotos[]` y `talles[]`.
- `talles[]`: `{ talle, estado }`. `estado` ∈ `disponible` | `agotado` | `bajo_pedido` | `consultar`.
- `tarjetas[]`: qué tarjetas de listado genera el producto (una por color en las fichas con variantes), con `color` e `imagen`. Se pueden generar automáticamente: una tarjeta por color.

**Reglas**
1. Un dato se carga una sola vez. Las tarjetas no tienen precio ni nombre propios: salen del producto.
2. El `estado` del talle **no se muestra** en la web (ver "Stock y disponibilidad"): todo se presenta como disponible y el stock se confirma por WhatsApp.
3. Cada color tiene sus propios talles. Ejemplo: Campera Gore-Tex, 4XL y 5XL solo en Negro y Verde OD; Azul Noche hasta 3XL.
4. Las fotos de `fotos[]` son las reales en `web/uploads/TC/`. Productos sin foto real quedan con `fotos: []` (en el prototipo se ven como placeholder).
5. `scraps/catalog-extract.json` es una extracción anterior y está desactualizada. Usar `data/catalog.json`.


---

## Fotos en Google Drive
Drive **no sirve como CDN** (lento, con límites de tráfico y URLs que cambian). Por eso las fotos **no se enlazan directo desde la web**:
1. Walter sube desde el panel → Drive (`TC/fotos/{slug}/`, compartido "cualquiera con el link") → la planilla guarda el **fileId**.
2. En el build, Astro descarga cada foto (`https://drive.google.com/uc?export=download&id={fileId}` o la Drive API), la cachea (Netlify build cache, por fileId) y la procesa con `astro:assets`: AVIF + WebP, `srcset` 400/800/1200/1600, `width`/`height` explícitos.
3. La web sirve las fotos desde Netlify con hash en el nombre y `Cache-Control: public, max-age=31536000, immutable`.
4. Nombres de archivo descriptivos en la salida: `{slug}-{color}-{n}.webp` (ej. `cinto-tactico-cobra-negro-1.webp`).
5. Las fotos actuales de `web/uploads/TC/` pueden quedar en el repo (`src/assets/`) para el arranque y migrar a Drive después.

---

## Infraestructura y operación
- **Dominio:** `tacticalcommand.com.ar` en NIC Argentina, con DNS en Netlify. Elegir una sola versión canónica (**sin www**, con HTTPS) y redirigir 301 las demás (`www`, `http`, `*.netlify.app`).
- **Netlify:** deploy automático en cada push a `main` y Build Hook para "Publicar". El plan gratis tiene un límite mensual de builds y de transferencia. Para reducir builds, Apps Script **agrupa** publicaciones: si hay dos publicaciones en menos de 2 minutos, hace un solo build. Revisar los límites vigentes del plan.
- **Copia de seguridad semanal de la planilla:** trigger de Apps Script por tiempo (semanal) que copia el archivo a `TC/backups/AAAA-MM-DD` y conserva las últimas 12.
- **"Seguí tu pedido", velocidad:** Apps Script puede tardar entre 1 y 3 s. Mostrar el estado "BUSCANDO TU PEDIDO…" con skeleton del stepper, deshabilitar el botón mientras busca, usar timeout de 10 s con mensaje de reintento, y errores claros ("Código o teléfono incorrectos"). Cachear la respuesta 60 s en `CacheService`.
- **QR de Data Fiscal (ARCA, ex AFIP):** el cliente lo genera en ARCA. Por ahora no se agrega. Cuando se sume, va en el footer junto a "Defensa al Consumidor".
- **Medición:**
  - **Google Analytics 4** y **Meta Pixel**, cargados **solo después del consentimiento** del banner de cookies que ya existe (categorías "Analíticas" y "Publicitarias"). Usar Consent Mode v2 de Google.
  - Eventos: `whatsapp_click` (con `producto`, `sku`, `color`, `talle`, `qty`, `tipo`: minorista/mayorista, `valor`), `view_item`, `select_color`, `select_talle`, `add_to_wholesale`, `track_order`, `arrepentimiento_submit`. En GA4, `whatsapp_click` se marca como **conversión clave**; en Meta, como `Contact` / `Lead`.
  - El clic a WhatsApp **es la venta**: medirlo en todos los botones (ficha, barra mobile, mayorista, footer, flotante).
- **Google Search Console:** verificar el dominio por DNS, enviar `sitemap-index.xml` y revisar cobertura e informes de rich results (Producto, FAQ, Breadcrumb).
- **Perfil de Empresa en Google (Google Maps):** crear o reclamar el perfil de Tactical Command en Rafaela con el mismo nombre, teléfono y horario que la web (sin dirección pública por ahora: configurarlo como negocio con área de servicio) (**mismos datos exactos**, NAP consistente), categoría "Tienda de artículos militares" o similar, fotos reales y link a la web. Pedir reseñas a clientes. Enlazar el perfil desde `sameAs` en el schema `Organization`.

---

## SEO / AEO / GEO: requisitos de implementación
Objetivo: posicionar en Google y que los buscadores con IA (Google AI Overviews, ChatGPT, Perplexity, Gemini) **citen** a Tactical Command como fuente. Esto es requisito de aceptación, no un extra. El prototipo ya genera título, descripción y JSON-LD por ruta (ver la función de meta cerca de `TC_SITE` en `web/Tactical Command v2.dc.html`): portar esa lógica y completarla con lo siguiente.

### 1. URLs y arquitectura
- Rutas reales, minúsculas, con guiones y barra final: `/`, `/equipos-tacticos/`, `/indumentaria/`, `/calzado/`, `/accesorios/`, `/productos/{slug}/`, `/guias/{slug}/`, `/nosotros/`, `/mayoristas/`, `/envios/`, `/arrepentimiento/`, `/legal/{slug}/`. `trailingSlash: 'always'` en Astro.
- **Variantes por color:** una sola URL por producto. `?color=` cambia la vista pero el **canonical** apunta siempre a `/productos/{slug}/`. El color se refleja en el schema como `ProductGroup` + `hasVariant`.
- Máximo 3 clics desde la home a cualquier ficha. Breadcrumbs visibles en todas las páginas internas.
- `_redirects`: las rutas hash viejas (`/#/productos/x/`) no llegan al servidor, así que resolverlas con un script mínimo en la home que lea `location.hash` y redirija. Redirigir 301 cualquier slug que cambie.
- 404 personalizada (con buscador y categorías) que devuelva status 404 real.

### 2. `<head>` por página
- `<html lang="es-AR">`, `<meta charset>`, `viewport`.
- `<title>` único (50–60 caracteres): `{Producto} {color/atributo} | Tactical Command`.
- `<meta name="description">` única (140–160 caracteres), con la respuesta principal y una llamada a la acción.
- `<link rel="canonical">` absoluta en **todas** las páginas.
- `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">`. En `/panel/`, la confirmación de arrepentimiento, búsquedas y resultados de seguimiento: `noindex,nofollow`.
- Open Graph (`og:type` = `product` o `article` o `website`, `og:title`, `og:description`, `og:url`, `og:image` 1200×630, `og:locale` = `es_AR`, `og:site_name`) y Twitter Card `summary_large_image`. Generar las imágenes OG en el build (foto del producto + logo).
- `<meta name="theme-color" content="#1A1D1B">`, favicons (svg, ico, 180 apple-touch) y `site.webmanifest`.
- `hreflang` no hace falta (un solo idioma y país); sí `og:locale`.
- Precarga de la fuente principal (`preload`, `font-display: swap`) y de la imagen LCP (`fetchpriority="high"`).

### 3. robots.txt, sitemap, llms.txt
- `robots.txt`: permitir todo salvo `/panel/` y `/api/`. **Permitir explícitamente** los crawlers de IA (GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Claude-SearchBot, Google-Extended, Applebot-Extended, Bingbot). Incluir la línea `Sitemap: https://tacticalcommand.com.ar/sitemap-index.xml`.
- `@astrojs/sitemap` con `lastmod` real (columna `actualizado` de la planilla) e image sitemap con las fotos de cada ficha. Excluir las páginas `noindex`.
- `/llms.txt` (y `/llms-full.txt`) generados en el build: qué es Tactical Command, ubicación, cómo comprar (WhatsApp), mayorista (mínimo de unidades), envíos, y lista de productos con URL, precio y descripción corta en Markdown.
- Feed RSS de guías (`/guias/rss.xml`).
- **IndexNow** (Bing/Yandex) en cada publicación, con ping desde Apps Script después del build.

### 4. HTML semántico
- Un solo `<h1>` por página. Jerarquía `h2`/`h3` sin saltos. Los títulos que hoy son `div` o `span` con estilo pasan a ser headings reales.
- Landmarks: `<header>`, `<nav aria-label="Principal">`, `<main id="contenido">`, `<footer>`, `<aside>` (relacionados), y un link "Saltar al contenido".
- Ficha: `<article>` del producto. Specs en `<table>` con `<th scope="row">` o en `<dl>`. FAQ con `<details>/<summary>` (el contenido sigue en el HTML aunque esté cerrado). Precio en `<data value="50000">`. Breadcrumb en `<nav aria-label="Migas de pan"><ol>`.
- Guías: `<article>` con `<time datetime>`, autor visible y fecha de actualización.
- Imágenes: `alt` descriptivo y único (producto + color + qué muestra la foto, ej. "Cinto táctico Cobra negro, detalle de la hebilla metálica"), `width`/`height`, `loading="lazy"` salvo la LCP, `decoding="async"`.
- Links internos con `<a href>` reales (nada de `onClick` para navegar). Botones de acción con `<button>`.
- Formularios con `<label for>`, `autocomplete` e `inputmode="numeric"` en teléfono y en los 4 dígitos.
- Accesibilidad WCAG 2.2 AA: contraste, foco visible dorado, `aria-current="page"`, carruseles navegables con teclado y `aria-live` en "Seguí tu pedido".

### 5. Datos estructurados (JSON-LD, uno por página, con `@graph` e `@id` enlazados)
- **Sitio completo:** `Organization` + `Store` (o `LocalBusiness`) con `@id: https://tacticalcommand.com.ar/#org`, `name`, `legalName`, `logo`, `image`, `url`, `telephone`, `email` (info@tacticalcommand.com.ar), `address` (`PostalAddress` solo con `addressLocality: Rafaela`, `addressRegion: Santa Fe`, `addressCountry: AR`: **no publicar calle ni número** por ahora), sin `geo`, `openingHoursSpecification`, `areaServed: AR`, `foundingDate: 2012`, `sameAs` (las redes que ya están en el footer del prototipo; **TikTok lo agrega el cliente después**, más el Perfil de Empresa en Google) y `contactPoint` (WhatsApp, ventas, `availableLanguage: es`). `WebSite` con `publisher` → `#org`.
- **Home:** `WebSite` + `Organization` + `ItemList` de productos destacados.
- **Landing de categoría:** `CollectionPage` + `ItemList` (posición, URL, nombre e imagen de cada producto) + `BreadcrumbList` + `FAQPage` (si tiene FAQ visible).
- **Ficha:** `ProductGroup` (`productGroupID` = SKU base, `variesBy`: color/talle) con `hasVariant` → `Product` por color (`sku`, `color`, `image[]`, `size`). Cada uno con `Offer` (`price`, `priceCurrency: ARS`, `availability: InStock` porque el stock se confirma por WhatsApp, `itemCondition: NewCondition`, `priceValidUntil`, `seller` → `#org`, `url`), `shippingDetails` (`OfferShippingDetails`, destino AR, costo a cargo del comprador) y `hasMerchantReturnPolicy` (`MerchantReturnPolicy` con los 10 días de arrepentimiento y `returnPolicyCategory`). Sumar `brand`, `category`, `material` y `additionalProperty` (`PropertyValue` por cada spec). `aggregateRating` + `review` **solo cuando haya reseñas reales visibles en la página**. `BreadcrumbList` + `FAQPage`.
- **Mayoristas:** `WebPage` + `Offer` con `eligibleQuantity` (`minValue` = `ws_minimo`) + `FAQPage`.
- **Guías:** `Article` / `BlogPosting` (`headline`, `image`, `datePublished`, `dateModified`, `author` → `Person` Walter Iman con `url` a /nosotros/, `publisher` → `#org`, `about`/`mentions` → productos) + `HowTo` cuando la guía es un paso a paso.
- **Nosotros:** `AboutPage` + `Organization` + `Person` (Walter) con `jobTitle` y `worksFor`.
- **Envíos, Arrepentimiento y Legales:** `WebPage` + `BreadcrumbList`. FAQ de envíos como `FAQPage`.
- **Regla:** todo lo que va en el schema tiene que estar **visible** en la página (precio, FAQ, reseñas). Validar cada plantilla en Rich Results Test y validator.schema.org como parte del QA. Agregar un test en CI que falle si una ficha no tiene `Product`, `Offer` o `BreadcrumbList`.
- **Google Merchant Center:** generar `/feed/productos.xml` (RSS 2.0 con `g:`) desde el catálogo para listados gratuitos en Google Shopping.

### 6. Contenido para AEO/GEO (para que las IA respondan con nosotros)
- **Primera frase de cada página = respuesta directa** de 40–60 palabras (qué es, para qué sirve, precio, cómo comprar). El campo `descripcion` ya está escrito así: mantenerlo arriba del pliegue y en HTML.
- FAQ con preguntas reales en lenguaje natural ("¿El cinto Cobra aguanta una pistolera?") y respuestas autocontenidas que se entiendan sin contexto.
- **Datos concretos y citables:** medidas, materiales, peso, capacidad en litros, talles, mínimo mayorista y plazos. Las IA citan cifras, no adjetivos.
- **Señales E-E-A-T:** autoría de las guías (Walter, 14 años en el rubro desde 2012), fotos reales de operación, dirección física, "Actualizado el {fecha}" visible en fichas y guías.
- Tablas comparativas en las landings como `<table>` real (las IA extraen tablas).
- Enlazado interno: cada ficha enlaza a su categoría, a 3–4 productos relacionados ("Completá el equipo") y a 1–2 guías. Cada guía enlaza a los productos que menciona. Textos de enlace descriptivos (no "ver más").
- Las tablas de medidas por talle, cuando estén, en HTML (no imagen).
- Nada de contenido oculto que solo cargue con JS: Astro tiene que entregar **todo el texto en el HTML inicial**. Los crawlers de IA no ejecutan JS.

### 7. Rendimiento (Core Web Vitals)
- Objetivos en celular real (4G): **LCP < 2,0 s, INP < 200 ms, CLS < 0,05**. Lighthouse ≥ 95 en Performance, SEO, Accesibilidad y Buenas prácticas.
- Astro con **cero JS por defecto**. Islas solo donde hay interacción (galería, selector de color/talle, carrito mayorista, seguimiento, cookies), con `client:visible` o `client:idle`.
- Video del hero: `poster` WebP como LCP, video con `preload="none"` que se carga después del LCP. En mobile, `saveData` o conexión lenta → solo poster.
- Fuentes self-hosted en WOFF2, con subset latino y `preload` de una o dos.
- CSS crítico inline (Astro lo hace) y sin librerías de UI pesadas.
- Headers en `netlify.toml`: caché inmutable para `/_astro/*`, `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy`. HSTS con el dominio definitivo.

### 8. Checklist de QA SEO antes de publicar
- Rich Results Test sin errores en: home, una landing, una ficha con variantes, una guía y mayoristas.
- Sin canonicals duplicados ni páginas indexables con `?color=`.
- `robots.txt`, `sitemap-index.xml`, `llms.txt` y `feed/productos.xml` accesibles y válidos.
- Ver el código fuente (sin JS) de una ficha: tiene que estar el H1, el precio, la descripción, las specs, las FAQ y el JSON-LD.
- Lighthouse mobile ≥ 95 en las 4 categorías.
- Search Console verificado, sitemap enviado y Perfil de Empresa en Google enlazado.
