# Guía del panel (para Walter)

El PDF está en `docs/Guia del panel - Tactical Command.pdf`. Para regenerarlo:

1. `node scripts/simulador-apps-script.mjs 8790` y `PUBLIC_TC_API=http://localhost:8790 npm run build`.
2. Servir `dist/` en el puerto 80 (`python3 -m http.server 80 -d dist`): las capturas simulan `tacticalcommand.com.ar` para que los mensajes muestren el dominio real.
3. `node docs/guia-panel/capturas.mjs <carpeta>/img` (con Playwright) y copiar `guia.html` a `<carpeta>`.
4. `node docs/guia-panel/pdf.mjs <carpeta>/guia.html <salida>.pdf`.
