# Tactical Command — web

Tienda online de Tactical Command (Rafaela, Santa Fe). Astro (SSG) + Netlify. El checkout no tiene pago online: el carrito arma un mensaje de WhatsApp.

El handoff de diseño completo (prototipos, especificación de la planilla, API y requisitos de SEO) está en [`design/HANDOFF.md`](design/HANDOFF.md).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # genera dist/ (incluye scripts/postbuild.mjs)
npm run check:seo  # valida title, description, canonical, H1 y JSON-LD de cada página
```

Node 22. El sitio está diseñado sobre un lienzo fijo (1718 px en desktop, 385 px en mobile) y se escala con `zoom`, igual que el prototipo (ver `src/layouts/Base.astro`).

## Estructura

| Ruta | Qué hay |
|---|---|
| `src/data/catalog.json` | Fuente única del catálogo (productos, colores, talles, tarjetas). |
| `src/data/categorias.json`, `guias.json`, `legales.json`, `sitio.json` | Contenido de categorías, guías, legales y datos del sitio. |
| `src/data/config.json` | Condiciones mayoristas (equivale a la hoja `config`). |
| `scripts/catalogo-desde-prototipo.mjs` | Regenera los JSON desde el prototipo (`design/Tactical Command v2.dc.html`). |
| `src/assets/tc/` | Fotos (se optimizan a WebP en el build). |
| `src/pages/` | Home, categorías, fichas (`productos/[slug]`), mayoristas, envíos, nosotros, guías, legales, arrepentimiento, feeds y `llms.txt`. |
| `src/scripts/` | JS del navegador: carrito, ficha, mayorista, medición. |
| `design/` | Handoff original, prototipos y videos sin usar. |

## Fases

1. **Web pública** (esta rama): catálogo desde `src/data/`, SEO completo, deploy en Netlify.
2. **Google Sheets + Apps Script**: la web lee el catálogo de la planilla en el build; `PUBLIC_TC_API` activa el seguimiento en vivo.
3. **Panel** (`/panel`, isla React).
4. **Medición** (GA4 + Meta Pixel con consentimiento), backups y QA en celular real.

## Pendientes con el cliente

Precios reales (hoy $ 50.000 de referencia en todos; Walter los carga desde el panel), SKU definitivos, dominio, fotos de la Gafa Sport y del Parche y link de TikTok confirmado.

Decisiones del cliente que difieren del handoff: el email de contacto sigue siendo el Gmail del prototipo; el seguimiento de pedidos pide solo el código (sin los 4 dígitos del teléfono), así que `action=track` en Apps Script valida solo por código; el arrepentimiento le avisa solo a Walter (el cliente ve el código en pantalla y no recibe mail).

## Pendientes para el panel (fase 3)

- Mensaje de WhatsApp del paso 0: sacar "y los últimos 4 dígitos de tu teléfono" (el seguimiento pide solo el código).
- Transporte: sumar **RETIRO EN RAFAELA** y **ENVÍO DENTRO DE RAFAELA** a la lista (Andreani, OCA, Correo Argentino, Vía Cargo, Otro). Con esas dos opciones el número de guía no es obligatorio, el mensaje del paso 2 cambia ("ya está listo para retirar" / "ya salió para tu domicilio") y la página "Tu pedido" muestra ese texto en lugar de "Despachado desde Rafaela" y no muestra guía ni botón de seguimiento del transporte.
- Al terminar el panel: guía de uso completa para Walter.

