import type { APIRoute } from 'astro';
import { llms } from '../lib/llms';
export const GET: APIRoute = () => new Response(llms(true), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
