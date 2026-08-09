/* ---------------------------------------------------------------------
   Service worker de "Mis cuentas RD$".

   Qué hace y qué NO hace:

   · Guarda el armazón de la app (HTML, iconos, fuentes) para que abra
     al instante y para que puedas instalarla en la pantalla de inicio.
   · NO guarda tus movimientos. Esos viven en Supabase y necesitan
     conexión. Sin internet la app abre, pero te avisa que no hay datos.
     Guardarlos en el teléfono exigiría una cola de sincronización y
     resolver conflictos: es otro proyecto, no un parche de dos líneas.

   Cuando cambies index.html, sube el número de VERSION para que los
   teléfonos ya instalados reciban la actualización.
   --------------------------------------------------------------------- */

const VERSION = 'v2';
const CACHE_APP = `miscuentas-app-${VERSION}`;
const CACHE_EXT = `miscuentas-externos-${VERSION}`;

const ARMAZON = [
  './',
  './index.html',
  './manifest.json',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
  './iconos/icono-maskable-512.png',
  './iconos/apple-touch-icon.png',
  './iconos/favicon-32.png'
];

self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);
    // addAll falla entero si un archivo falla; los agregamos uno a uno
    await Promise.all(ARMAZON.map(u =>
      cache.add(new Request(u, {cache: 'reload'})).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres
      .filter(n => n.startsWith('miscuentas-') && n !== CACHE_APP && n !== CACHE_EXT)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'actualizar-ya') self.skipWaiting();
});

self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca tocar las llamadas a Supabase: siempre red, nunca caché.
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) return;

  // Navegación: red primero (para recibir cambios), caché si no hay señal.
  if (req.mode === 'navigate') {
    evento.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok && !res.redirected) {
          (await caches.open(CACHE_APP)).put('./index.html', res.clone());
        }
        return res;
      } catch {
        const cache = await caches.open(CACHE_APP);
        return (await cache.match('./index.html')) || (await cache.match('./')) ||
               new Response('Sin conexión', {status: 503, headers: {'Content-Type': 'text/plain'}});
      }
    })());
    return;
  }

  // Archivos propios (config.js, iconos): red primero, caché de respaldo.
  if (url.origin === self.location.origin) {
    evento.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok && !res.redirected) {
          (await caches.open(CACHE_APP)).put(req, res.clone());
        }
        return res;
      } catch {
        const enCache = await caches.match(req);
        if (enCache) return enCache;
        // nada en caché y sin red: responder, nunca lanzar
        return new Response('', {status: 503, statusText: 'Sin conexión'});
      }
    })());
    return;
  }

  // Fuentes y librerías de CDN: caché primero, casi nunca cambian.
  evento.respondWith((async () => {
    const enCache = await caches.match(req);
    if (enCache) return enCache;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        (await caches.open(CACHE_EXT)).put(req, res.clone());
      }
      return res;
    } catch {
      return new Response('', {status: 504});
    }
  })());
});
