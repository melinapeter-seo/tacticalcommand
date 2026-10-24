// Genera apps-script/Semilla.gs: columnas de productos/variantes y el catálogo actual del repo como filas,
// para que `instalar()` cargue la planilla con lo que hoy está publicado.
import fs from 'node:fs';
import path from 'node:path';
import { COLS, aFilas } from './lib/planilla.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, 'src/data', f), 'utf8'));
// `actualizado` vacío: se completa al publicar cada cambio (y la semilla no cambia de un día a otro).
const filas = aFilas(leer('catalog.json'), leer('categorias.json'), leer('config.json'), '');
const clave = fs.readdirSync(path.join(RAIZ, 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, -4) || '';
const salida = `// Generado por scripts/generar-semilla.mjs a partir de src/data/. No editar a mano.
const COLUMNAS = ${JSON.stringify(COLS)};
const INDEXNOW_KEY = ${JSON.stringify(clave)};
const SEMILLA = ${JSON.stringify(filas, null, 1)};
`;
fs.writeFileSync(path.join(RAIZ, 'apps-script/Semilla.gs'), salida);
console.log(`Semilla.gs: ${filas.productos.length} productos, ${filas.variantes.length} variantes.`);
