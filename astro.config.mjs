import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import catalogo from './src/data/catalog.json' with { type: 'json' };

const SITE = 'https://tacticalcommand.com.ar';

// lastmod real por ficha (columna `actualizado` de la planilla en la fase 2).
const lastmod = Object.fromEntries(catalogo.productos.filter((p) => p.actualizado).map((p) => [`${SITE}/productos/${p.slug}/`, p.actualizado]));

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  compressHTML: true,
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  image: { responsiveStyles: false },
  integrations: [
    sitemap({
      filter: (page) => !/\/(panel|api|arrepentimiento\/confirmacion|404)\//.test(page),
      serialize: (item) => (lastmod[item.url] ? { ...item, lastmod: lastmod[item.url] } : item),
    }),
  ],
});
