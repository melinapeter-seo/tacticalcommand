// Simulador local del Apps Script: carga apps-script/*.gs en Node con imitaciones de SpreadsheetApp, CacheService,
// PropertiesService, DriveApp, etc. Sirve para probar la API sin Google y para desarrollar el panel.
//   node scripts/simulador-apps-script.mjs [puerto]   → http://localhost:8790 (GET y POST como la Web App)
// Como módulo: crearSimulador() devuelve { ctx, get(params), post(body), estado }.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import crypto from 'node:crypto';

const RAIZ = path.resolve(import.meta.dirname, '..');

export function crearSimulador({ props = {} } = {}) {
  const estado = { hojas: {}, cache: new Map(), props: { ...props }, triggers: [], fetches: [], drive: {} };

  // ---------- Sheets ----------
  const COLS_MAX = 30, FILAS_MAX = 1000;
  function crearHoja(nombre) {
    const celdas = [];      // celdas[f][c], base 0
    const casilla = new Set(); // "f,c" con validación de casilla
    const val = (f, c) => (celdas[f] && celdas[f][c] !== undefined ? celdas[f][c] : '');
    const set = (f, c, v) => { (celdas[f] ||= [])[c] = v; };
    const h = {
      nombre, celdas,
      getName: () => nombre,
      getLastRow: () => { for (let f = celdas.length - 1; f >= 0; f--) if ((celdas[f] || []).some((v) => v !== '' && v !== undefined)) return f + 1; return 0; },
      getMaxRows: () => FILAS_MAX, getMaxColumns: () => COLS_MAX,
      setFrozenRows: () => h, setTabColor: () => h,
      protect: () => { const p = { setDescription: () => p, setWarningOnly: () => { h._prot = true; return p; } }; return p; },
      getProtections: () => (h._prot ? [{}] : []),
      appendRow: (fila) => { const f = h.getLastRow(); fila.forEach((v, c) => set(f, c, v)); return h; },
      getRange: (r, c, nr = 1, nc = 1) => {
        if (typeof r === 'string') { c = 1; r = 1; }
        const rg = {
          getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => val(r - 1 + i, c - 1 + j))),
          setValues: (vs) => { if (vs.length !== nr || vs.some((x) => x.length !== nc)) throw new Error(`setValues: tamaño ${vs.length}x${vs[0]?.length} ≠ ${nr}x${nc}`); vs.forEach((x, i) => x.forEach((v, j) => set(r - 1 + i, c - 1 + j, v))); return rg; },
          // En Sheets, borrar el contenido de una casilla la deja en FALSE (sigue teniendo la validación).
          clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) set(r - 1 + i, c - 1 + j, casilla.has(`${r - 1 + i},${c - 1 + j}`) ? false : ''); return rg; },
          clearDataValidations: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) casilla.delete(`${r - 1 + i},${c - 1 + j}`); return rg; },
          insertCheckboxes: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { casilla.add(`${r - 1 + i},${c - 1 + j}`); if (val(r - 1 + i, c - 1 + j) === '') set(r - 1 + i, c - 1 + j, false); } return rg; },
          setNumberFormat: () => rg, setFontWeight: () => rg, setBackground: () => rg, setFontColor: () => rg, setNote: () => rg,
        };
        return rg;
      },
    };
    return h;
  }
  const libro = {
    getSheetByName: (n) => estado.hojas[n] || null,
    insertSheet: (n) => (estado.hojas[n] = crearHoja(n)),
    getSheets: () => Object.values(estado.hojas),
    deleteSheet: (h) => { delete estado.hojas[h.getName()]; },
    getId: () => 'planilla-simulada',
  };

  // ---------- Drive ----------
  let nId = 0;
  const nuevoId = () => 'sim' + String(++nId).padStart(30, '0');
  const iterador = (arr) => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  function carpeta(nombre, padre) {
    const id = nuevoId();
    const c = {
      id, nombre, padre, hijos: [], archivos: [],
      getId: () => id, getName: () => nombre,
      getFoldersByName: (n) => iterador(c.hijos.filter((x) => x.nombre === n)),
      createFolder: (n) => { const x = carpeta(n, c); c.hijos.push(x); return x; },
      getParents: () => iterador(padre ? [padre] : []),
      getFiles: () => iterador(c.archivos.filter((a) => !a.borrado)),
      createFile: (blob) => archivo(blob, c),
    };
    estado.drive[id] = c;
    return c;
  }
  function archivo(blob, padre) {
    const id = nuevoId();
    const a = {
      id, blob, borrado: false, creado: Date.now() + nId,
      getId: () => id, getName: () => blob.nombre, getBlob: () => blob, getParents: () => iterador([padre]),
      getDateCreated: () => new Date(a.creado), setTrashed: (v) => { a.borrado = v; },
      makeCopy: (n, dir) => archivo({ ...blob, nombre: n }, dir),
    };
    padre.archivos.push(a);
    estado.drive[id] = a;
    return a;
  }
  const raizDrive = carpeta('Mi unidad', null);
  // La planilla también es un archivo de Drive (para los backups).
  estado.drive['planilla-simulada'] = { blob: {}, makeCopy: (n, dir) => archivo(blob([], 'application/vnd.google-apps.spreadsheet', n), dir) };
  const blob = (bytes, mime, nombre) => ({ bytes: Buffer.from(bytes), mime, nombre, getBytes: () => [...Buffer.from(bytes)], getContentType: () => mime });

  // ---------- Servicios ----------
  const ctx = {
    console, Logger: { log: () => {} }, Date, Math, JSON, Set, Map, Object, Array, String, Number, Buffer: undefined,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => libro,
      getUi: () => { throw new Error('Sin interfaz en el simulador'); },
      ProtectionType: { SHEET: 'SHEET' },
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => { const e = estado.cache.get(k); return e && e.hasta > Date.now() ? e.v : null; },
        put: (k, v, s = 600) => { if (String(v).length > 100000) throw new Error('Cache: valor demasiado grande'); estado.cache.set(k, { v: String(v), hasta: Date.now() + s * 1000 }); },
        remove: (k) => estado.cache.delete(k),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in estado.props ? estado.props[k] : null),
        setProperty: (k, v) => { estado.props[k] = String(v); },
        deleteProperty: (k) => { delete estado.props[k]; },
      }),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ texto: t, setMimeType() { return this; } }) },
    Utilities: {
      computeHmacSha256Signature: (s, k) => [...crypto.createHmac('sha256', k).update(s).digest()].map((b) => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes.map((b) => b & 255)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64Encode: (bytes) => Buffer.from(bytes.map((b) => b & 255)).toString('base64'),
      base64Decode: (s) => [...Buffer.from(s, 'base64')],
      getUuid: () => crypto.randomUUID(),
      newBlob: (bytes, mime, nombre) => blob(bytes.map((b) => b & 255), mime, nombre),
      formatDate: (d) => d.toISOString().slice(0, 10),
    },
    ScriptApp: {
      WeekDay: { MONDAY: 'MONDAY' },
      newTrigger: (fn) => {
        const t = { fn, getHandlerFunction: () => fn };
        const b = { timeBased: () => b, after: (ms) => { t.after = ms; return b; }, onWeekDay: () => b, atHour: () => b, create: () => { estado.triggers.push(t); return t; } };
        return b;
      },
      getProjectTriggers: () => [...estado.triggers],
      deleteTrigger: (t) => { estado.triggers = estado.triggers.filter((x) => x !== t); },
    },
    UrlFetchApp: { fetch: (url, op) => { estado.fetches.push({ url, op }); return { getResponseCode: () => 200 }; } },
    DriveApp: {
      getFoldersByName: (n) => raizDrive.getFoldersByName(n),
      createFolder: (n) => raizDrive.createFolder(n),
      getFileById: (id) => { const a = estado.drive[id]; if (!a || !a.blob) throw new Error('No existe el archivo ' + id); return a; },
    },
  };
  vm.createContext(ctx);
  // Igual que en Apps Script, cada archivo se ejecuta por separado. Codigo.gs va primero a propósito:
  // así se prueba que su código de nivel superior no dependa de Semilla.gs.
  for (const f of ['Codigo.gs', 'Semilla.gs']) vm.runInContext(fs.readFileSync(path.join(RAIZ, 'apps-script', f), 'utf8'), ctx, { filename: f });

  const salida = (r) => JSON.parse(r.texto);
  return {
    ctx, estado,
    get: (parameter) => salida(ctx.doGet({ parameter })),
    post: (body) => salida(ctx.doPost({ postData: { contents: JSON.stringify(body) } })),
    correrTriggers: (fn) => estado.triggers.filter((t) => !fn || t.fn === fn).forEach((t) => ctx[t.fn]()),
  };
}

// ---------- Servidor ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const puerto = Number(process.argv[2]) || 8790;
  const sim = crearSimulador({ props: { PIN: '123456', DEPLOY_HOOK_URL: 'https://api.netlify.com/build_hooks/simulado' } });
  sim.ctx.instalar();
  http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    r.setHeader('Access-Control-Allow-Origin', '*');
    r.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (q.method === 'POST') {
      let b = '';
      q.on('data', (c) => (b += c));
      q.on('end', () => r.end(JSON.stringify(sim.post(JSON.parse(b || '{}')))));
      return;
    }
    r.end(JSON.stringify(sim.get(Object.fromEntries(u.searchParams))));
  }).listen(puerto, () => console.log(`Apps Script simulado en http://localhost:${puerto} (PIN 123456)`));
}
