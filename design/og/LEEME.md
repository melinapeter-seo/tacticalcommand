# Imágenes para compartir (Open Graph)

`og.html` tiene los dos diseños fijos: **B** (web: home y páginas que no son productos ni categorías) y **C** (panel).
Para regenerarlos: `node design/og/render.mjs design/og/og.html <carpeta>` (con Playwright) y copiar
`og-B.jpg` → `src/assets/og/web.jpg` y `og-C.jpg` → `src/assets/og/panel.jpg`.
Productos y categorías se generan solos en el build (`src/pages/og/[...ruta].jpg.ts`).
