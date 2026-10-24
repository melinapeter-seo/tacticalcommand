# Instalar la planilla y la API (fase 2)

Se hace una sola vez, con la cuenta **contacto@melinapeter.com.ar**. Tiempo: unos 20 minutos.
Al terminar, la web lee el catálogo de la planilla y el seguimiento de pedidos funciona en vivo.

## 1. Crear la planilla

1. Con la sesión de contacto@melinapeter.com.ar abierta, entrá a <https://sheets.new>.
2. Ponele de nombre **Tactical Command — Catálogo y pedidos**.

## 2. Pegar el código

1. En la planilla: **Extensiones › Apps Script**. Se abre el editor en otra pestaña.
2. Arriba a la izquierda, cambiá "Proyecto sin título" por **Tactical Command API**.
3. Abrí [`apps-script/Codigo.gs`](https://github.com/melinapeter-seo/tacticalcommand/blob/main/apps-script/Codigo.gs) en GitHub, tocá el botón **Copy raw file** (el ícono de copiar, arriba a la derecha del archivo) y pegalo en `Código.gs`, reemplazando todo lo que haya.
4. En el editor, al lado de **Archivos**, tocá **+ › Secuencia de comandos** y llamalo `Semilla`. Copiá y pegá ahí [`apps-script/Semilla.gs`](https://github.com/melinapeter-seo/tacticalcommand/blob/main/apps-script/Semilla.gs) de la misma forma.
5. Guardá (ícono del disquete o Ctrl + S).

## 3. Instalar

1. En la barra del editor, en el menú desplegable de funciones, elegí **instalar** y tocá **Ejecutar**.
2. Google pide permisos: **Revisar permisos** › elegí la cuenta › aparece "Google no verificó esta app" › **Configuración avanzada** › **Ir a Tactical Command API (no seguro)** › **Permitir**. Es normal: la app es tuya y no está publicada en Google.
3. Cuando termine ("Ejecución completada"), volvé a la pestaña de la planilla y **recargala**. Vas a ver las hojas creadas y cargadas con el catálogo actual, y un menú nuevo **Tactical Command**.

Las hojas:

| Hoja | Para qué |
|---|---|
| `productos_draft`, `variantes_draft`, `config_draft` (pestaña dorada) | **Borrador.** Acá se hacen los cambios. |
| `productos`, `variantes`, `config` (pestaña verde) | Lo publicado. No se editan a mano: se reemplazan al publicar. |
| `pedidos`, `clientes` | Los va a cargar el panel (fase 3). |

## 4. PIN del panel

Menú **Tactical Command › Configurar PIN del panel**. Entre 6 y 12 números. Es la clave con la que Walter va a entrar al panel; guardala para pasársela.

## 5. Publicar la API

1. En el editor de Apps Script: **Implementar › Nueva implementación**.
2. En el engranaje de "Seleccionar tipo", elegí **Aplicación web**.
3. Descripción: `API`. **Ejecutar como: Yo**. **Quién tiene acceso: Cualquier usuario**.
4. **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).
5. Probala: pegá en el navegador esa URL agregándole `?action=catalog` al final. Tiene que aparecer un texto que empieza con `{"ok":true,"data":{"productos":[`.

"Cualquier usuario" es necesario para que la web y el build puedan leer el catálogo. Solo es público lo que ya está en la web (catálogo publicado y el estado de un pedido si se conoce su código). Todo lo demás pide el PIN.

## 6. Conectar con Netlify

1. **Build Hook**: en Netlify, en el proyecto tacticalcommand: **Project configuration › Build & deploy › Continuous deployment › Build hooks › Add build hook**. Nombre: `Planilla`, rama: `main`. Copiá la URL que genera (`https://api.netlify.com/build_hooks/…`).
2. En la planilla: **Tactical Command › Configurar Build Hook de Netlify** y pegala.
3. **Variable de entorno**: en Netlify, **Project configuration › Environment variables › Add a variable**. Key: `PUBLIC_TC_API`. Value: la URL `/exec` del paso 5. Guardá.
4. **Deploys › Trigger deploy › Deploy project** para que tome la variable.

## 7. Probar

1. En `productos_draft`, cambiá el precio de un producto.
2. **Tactical Command › Publicar en la web** › Sí.
3. En 1 o 2 minutos el precio nuevo aparece en la web. Después volvelo a $ 50.000 y publicá de nuevo.

## 8. Compartir con Walter

**Compartir** › el mail de Walter › **Editor**. La primera vez que él use el menú Tactical Command, Google le va a pedir los mismos permisos del paso 3.2.

---

## Para tener en cuenta

- **Si cambia el código** (`Codigo.gs` o `Semilla.gs`): pegar la versión nueva y después **Implementar › Gestionar implementaciones › ✏️ › Versión: Nueva versión › Implementar**. Así la URL `/exec` sigue siendo la misma. Una "Nueva implementación" crea otra URL y habría que cambiarla en Netlify.
- **Backups**: todos los lunes a las 4 se guarda una copia en Drive, en `TC/backups/AAAA-MM-DD` (quedan las últimas 12). Las fotos que suba el panel van a `TC/fotos/{producto}/`.
- **Si la planilla no responde** durante un build, la web se publica con la última versión buena del catálogo; nunca queda vacía.
- **Pasarle todo a Walter** (más adelante): él hace una copia de la planilla en su cuenta (Archivo › Hacer una copia, que copia también el código), repite los pasos 3 a 6 y se cambia `PUBLIC_TC_API` en Netlify. Los PIN y el Build Hook se vuelven a cargar desde el menú.
- **IndexNow** (aviso a Bing de los cambios): queda listo para cuando la web esté en tacticalcommand.com.ar. En el editor, **Configuración del proyecto › Propiedades de la secuencia de comandos**, agregar `SITE_URL` = `https://tacticalcommand.com.ar`.
