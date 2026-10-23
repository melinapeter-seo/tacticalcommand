// Datos estructurados (JSON-LD) y helpers de meta. Un solo @graph por página, con @id enlazados.
import { SITE, sitio } from './data';

export const ORG_ID = `${SITE}/#org`;
export const SITE_ID = `${SITE}/#website`;
export const WALTER_ID = `${SITE}/nosotros/#walter`;
export const EMAIL = 'info@tacticalcommand.com.ar';
export const TEL = '+54-9-3492-649494';

export const abs = (p: string) => (p.startsWith('http') ? p : SITE + p);

export const org = () => ({
  '@type': ['Organization', 'Store'],
  '@id': ORG_ID,
  name: 'Tactical Command',
  legalName: 'Tactical Command',
  url: SITE + '/',
  logo: abs('/favicon-512.png'),
  image: abs('/og/default.jpg'),
  description: 'Tienda de indumentaria, equipos, calzado y accesorios tácticos desde 2012, para trabajo, uso operativo y outdoor. Venta minorista y mayorista con envíos a todo el país.',
  telephone: TEL,
  email: EMAIL,
  foundingDate: '2012',
  address: { '@type': 'PostalAddress', addressLocality: 'Rafaela', addressRegion: 'Santa Fe', addressCountry: 'AR' },
  areaServed: { '@type': 'Country', name: 'Argentina' },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '12:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '16:00', closes: '20:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday', 'Sunday'], opens: '09:00', closes: '15:00' },
  ],
  sameAs: sitio.redes.filter((u) => !/tiktok/.test(u)),
  contactPoint: { '@type': 'ContactPoint', telephone: TEL, contactType: 'sales', areaServed: 'AR', availableLanguage: 'es', url: `https://wa.me/${sitio.whatsapp}` },
});

export const website = () => ({ '@type': 'WebSite', '@id': SITE_ID, name: 'Tactical Command', url: SITE + '/', inLanguage: 'es-AR', publisher: { '@id': ORG_ID } });

export const walter = () => ({ '@type': 'Person', '@id': WALTER_ID, name: 'Walter Iman', jobTitle: 'Fundador de Tactical Command', url: abs('/nosotros/'), worksFor: { '@id': ORG_ID } });

export const breadcrumbs = (parts: [string, string][]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: parts.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(url) })),
});

export const faqPage = (qa: { q: string; a: string }[]) => {
  const m = qa.filter((x) => !/a confirmar/i.test(x.q + ' ' + x.a));
  return m.length ? { '@type': 'FAQPage', mainEntity: m.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) } : null;
};

export const graph = (...nodes: any[]) => ({ '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) });

/** Recorta a ~160 caracteres sin cortar palabras. */
export const desc = (s: string, n = 160) => (s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '…' : s);

export const cap = (s: string) => s.toLowerCase().replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase());
