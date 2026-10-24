# Tactical Command — web

Tienda online de Tactical Command (Rafaela, Santa Fe). Astro (SSG) + Netlify. El checkout no tiene pago online: el carrito arma un mensaje de WhatsApp.

El handoff de diseño completo (prototipos, especificación de la planilla, API y requisitos de SEO) está en [`design/HANDOFF.md`](design/HANDOFF.md).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # genera dist/ (incluye scripts/postbuild.mjs)
npm run check:seo  # valida title, description, canonical, H1 y JSON-LD de cada página
npm run test:api   # prueba el Apps Script contra el simulador (sin Google)
npm run semilla    # regenera apps-script/Semilla.gs desde src/data/
node scripts/simulador-apps-script.mjs   # API simulada en :8790 (PIN 123456), para el panel
```

`dev` y `build` corren antes `npm run sync`: con `PUBLIC_TC_API` lee la planilla publicada; sin ella usa `src/data/`.

Node 22. El sitio está diseñado sobre un lienzo fijo (1718 px en desktop, 385 px en mobile) y se escala con `zoom`, igual que el prototipo (ver `src/layouts/Base.astro`).

## Estructura

| Ruta | Qué hay |
|---|---|
| `src/data/catalog.json` | Catálogo base: contenido largo de las fichas (textos, specs, FAQ, guía, tarjetas). La planilla manda en nombre, categoría, SKU, descripción, precios, colores, fotos, talles, visibilidad y orden. |
| `src/data/generado/` | Lo que usa la web: planilla + catálogo base (lo arma `scripts/sincronizar-catalogo.mjs`, no se versiona). |
| `apps-script/` | API de la planilla (`Codigo.gs`), semilla generada (`Semilla.gs`) y guía de instalación (`INSTALAR.md`). |
| `src/data/categorias.json`, `guias.json`, `legales.json`, `sitio.json` | Contenido de categorías, guías, legales y datos del sitio. |
| `src/data/config.json` | Condiciones mayoristas (equivale a la hoja `config`). |
| `scripts/catalogo-desde-prototipo.mjs` | Regenera los JSON desde el prototipo (`design/Tactical Command v2.dc.html`). |
| `src/assets/tc/` | Fotos (se optimizan a WebP en el build). |
| `src/pages/` | Home, categorías, fichas (`productos/[slug]`), mayoristas, envíos, nosotros, guías, legales, arrepentimiento, feeds y `llms.txt`. |
| `src/scripts/` | JS del navegador: carrito, ficha, mayorista, medición. |
| `design/` | Handoff original, prototipos y videos sin usar. |

## Fases

1. **Web pública** (esta rama): catálogo desde `src/data/`, SEO completo, deploy en Netlify.
2. **Google Sheets + Apps Script**: la web lee el catálogo de la planilla en el build; `PUBLIC_TC_API` activa el seguimiento en vivo. Instalación: [`apps-script/INSTALAR.md`](apps-script/INSTALAR.md).
3. **Panel** (`/panel`, isla React).
4. **Medición** (GA4 + Meta Pixel con consentimiento), backups y QA en celular real.

## Pendientes con el cliente

Precios reales (hoy $ 50.000 de referencia en todos; Walter los carga desde el panel), SKU definitivos, dominio, fotos de la Gafa Sport y del Parche y link de TikTok confirmado.

Decisiones del cliente que difieren del handoff: el email de contacto sigue siendo el Gmail del prototipo; el seguimiento de pedidos pide solo el código (sin los 4 dígitos del teléfono), así que `action=track` en Apps Script valida solo por código; el arrepentimiento le avisa solo a Walter (el cliente ve el código en pantalla y no recibe mail).

## Pendientes para el panel (fase 3)

- Mensaje de WhatsApp del paso 0: sacar "y los últimos 4 dígitos de tu teléfono" (el seguimiento pide solo el código).
- Transporte: sumar **RETIRO EN RAFAELA** y **ENVÍO DENTRO DE RAFAELA** a la lista (Andreani, OCA, Correo Argentino, Vía Cargo, Otro). Con esas dos opciones el número de guía no es obligatorio y el mensaje del paso 2 cambia ("ya está listo para retirar" / "ya salió para tu domicilio"). Ya resuelto en la API (`advanceOrder` no pide guía) y en la página de seguimiento ("Listo para retirar" / "En camino", sin guía ni botón del transporte); falta el panel.
- El panel manda los POST como `text/plain` (Apps Script no responde el preflight de CORS).
- **Fichas editables desde el panel** (decisión con Melina). El contenido largo de las fichas pasa del repo a la planilla (hoja `fichas`), sin cambios visibles en la web.
  - Productos nuevos: Walter carga nombre, fotos por color, categoría (las 4 fijas), subcategoría (elige una existente o crea una nueva), colores, talles y precio. Después completa cada parte de la ficha con campos guiados: descripción corta y larga, características, especificaciones (clave / valor), preguntas frecuentes, title y description de SEO, productos relacionados. Cada campo muestra un ejemplo de una ficha de la misma categoría. Además hay un bloque libre sin límite para sus notas.
  - Semáforo de calidad por ficha (descripción ≥ 120 caracteres, especificaciones, preguntas frecuentes, cantidad de fotos). Informa, no bloquea.
  - Botón **«Pedirle a Melina que la arme»**: deja el producto en borrador marcado como pendiente y le avisa a Melina. Ella completa la ficha y la publica.
  - Fichas existentes: se editan a mano, sin IA. Cada publicación guarda la versión anterior de la ficha, con un botón **«Volver a la versión anterior»**.
  - Sin IA por ahora (evaluado: necesita cuenta de API prepaga aparte de la suscripción). La estructura queda lista para sumar un botón «Optimizar con IA» más adelante.
- Fotos: el panel las comprime en el celular a WebP de hasta 1600 px y avisa si tienen menos de 1200 px. Walter no usa Drive.
- Al terminar el panel: guía de uso completa para Walter.

