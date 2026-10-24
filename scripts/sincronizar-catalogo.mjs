// Prebuild: arma el catálogo que usa la web en src/data/generado/.
// - Con PUBLIC_TC_API: lee lo publicado en la planilla (`action=catalog`) y lo combina con el contenido
//   largo del repo (src/data/catalog.json y categorias.json). Las fotos de Drive se bajan y se pasan a WebP.
// - Si la API falla o responde algo inválido: usa la última respuesta buena (caché) y, si no hay, el repo.
//   Así un problema con Google nunca deja la web vacía ni corta el build.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { combinar } from './lib/planilla.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DATA = path.join(RAIZ, 'src/data');
const SALIDA = path.join(DATA, 'generado');
const FOTOS = path.join(RAIZ, 'src/assets/tc');
const CACHE = path.join(RAIZ, 'node_modules/.cache/tc');
const API = (process.env.PUBLIC_TC_API || '').trim();

const leer = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const escribir = (f, d) => fs.writeFile(f, JSON.stringify(d, null, 2) + '\n');
const existe = (f) => fs.access(f).then(() => true, () => false);
const log = (...a) => console.log('[catálogo]', ...a);

/** ID de Drive a partir de la celda: ID suelto, link /d/ID o ?id=ID. */
export const idDrive = (v) => {
  const s = String(v).trim();
  return s.match(/\/d\/([\w-]{20,})/)?.[1] || s.match(/[?&]id=([\w-]{20,})/)?.[1] || (/^[\w-]{25,}$/.test(s) && !/\.\w{3,4}$/.test(s) ? s : null);
};

async function pedir(params, ms = 25000) {
  const url = `${API}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (d.ok === false) throw new Error(d.error || 'respuesta con error');
  return d.data ?? d; // { ok, data } (Apps Script)
}

/** La respuesta tiene que traer productos con al menos una variante; si no, no se publica. */
function validar(d) {
  if (!Array.isArray(d?.productos) || !Array.isArray(d?.variantes)) throw new Error('faltan productos o variantes');
  const conVar = new Set(d.variantes.map((v) => v.slug));
  const n = d.productos.filter((p) => p.slug && conVar.has(p.slug)).length;
  if (n === 0) throw new Error('la planilla no tiene productos publicados');
  return d;
}

/** Baja las fotos de Drive que falten (por el propio Apps Script, que solo entrega archivos de TC/fotos). */
async function bajarFotos(api) {
  const ids = new Set();
  for (const v of api.variantes) for (const f of String(v.fotos || '').split('|')) { const id = idDrive(f); if (id) ids.add(id); }
  await fs.mkdir(path.join(CACHE, 'fotos'), { recursive: true });
  let nuevas = 0;
  for (const id of ids) {
    const destino = path.join(FOTOS, `drive-${id}.webp`);
    const enCache = path.join(CACHE, 'fotos', `drive-${id}.webp`);
    if (await existe(destino)) continue;
    if (!(await existe(enCache))) {
      try {
        const { base64 } = await pedir({ action: 'photo', id }, 60000);
        await sharp(Buffer.from(base64, 'base64')).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 90 }).toFile(enCache);
        nuevas++;
      } catch (e) {
        console.warn(`[catálogo] no se pudo bajar la foto ${id}: ${e.message}`);
        continue;
      }
    }
    await fs.copyFile(enCache, destino);
  }
  if (ids.size) log(`fotos de Drive: ${ids.size} (${nuevas} nuevas)`);
}

async function main() {
  const base = await leer(path.join(DATA, 'catalog.json'));
  const categoriasBase = await leer(path.join(DATA, 'categorias.json'));
  const configBase = await leer(path.join(DATA, 'config.json'));
  await fs.mkdir(SALIDA, { recursive: true });

  let api = null, origen = 'repo';
  if (API) {
    try {
      api = validar(await pedir({ action: 'catalog' }));
      origen = 'planilla';
      await fs.mkdir(CACHE, { recursive: true });
      await escribir(path.join(CACHE, 'catalog.json'), api);
    } catch (e) {
      console.warn(`[catálogo] la API falló (${e.message}); pruebo con la última respuesta guardada.`);
      try { api = validar(await leer(path.join(CACHE, 'catalog.json'))); origen = 'caché'; } catch { api = null; }
    }
  }

  if (!api) {
    await escribir(path.join(SALIDA, 'catalog.json'), base);
    await escribir(path.join(SALIDA, 'categorias.json'), categoriasBase);
    await escribir(path.join(SALIDA, 'config.json'), configBase);
    log(API ? 'sin planilla disponible: se usa el catálogo del repo.' : 'PUBLIC_TC_API vacío: se usa el catálogo del repo.');
    return;
  }

  await bajarFotos(api);
  const locales = new Set(await fs.readdir(FOTOS));
  const resolverFoto = (v) => {
    const s = String(v).trim();
    if (locales.has(s)) return s;
    const id = idDrive(s);
    if (id && locales.has(`drive-${id}.webp`)) return `drive-${id}.webp`;
    console.warn(`[catálogo] foto no encontrada: "${s}"`);
    return null;
  };

  const { catalogo, categorias, config } = combinar(api, base, categoriasBase, resolverFoto);
  await escribir(path.join(SALIDA, 'catalog.json'), catalogo);
  await escribir(path.join(SALIDA, 'categorias.json'), categorias);
  const conValor = Object.entries(config).filter(([, v]) => v !== '' && v != null);
  await escribir(path.join(SALIDA, 'config.json'), { ...configBase, ...Object.fromEntries(conValor) });
  log(`${catalogo.productos.length} productos desde la ${origen}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
