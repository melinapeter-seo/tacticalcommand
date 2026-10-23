// Eventos de medición. GA4 y Meta Pixel se cargan solo con consentimiento (fase 4);
// mientras tanto los eventos quedan en dataLayer y no se envían a ningún lado.
export function track(event: string, params: Record<string, unknown> = {}) {
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event, ...params });
  if (typeof w.gtag === 'function') w.gtag('event', event, params);
  if (typeof w.fbq === 'function' && event === 'whatsapp_click') w.fbq('track', 'Contact', params);
}
