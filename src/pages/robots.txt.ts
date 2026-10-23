import type { APIRoute } from 'astro';
import { SITE } from '../lib/data';

// Se permite todo salvo el panel y la API; los crawlers de IA se permiten explícitamente.
const IA = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Claude-SearchBot', 'Google-Extended', 'Applebot-Extended', 'Bingbot'];

export const GET: APIRoute = () => new Response(
  [
    'User-agent: *',
    'Allow: /',
    'Disallow: /panel/',
    'Disallow: /api/',
    '',
    ...IA.flatMap((ua) => [`User-agent: ${ua}`, 'Allow: /', 'Disallow: /panel/', 'Disallow: /api/', '']),
    `Sitemap: ${SITE}/sitemap-index.xml`,
    `Sitemap: ${SITE}/sitemap-imagenes.xml`,
    '',
  ].join('\n'),
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
