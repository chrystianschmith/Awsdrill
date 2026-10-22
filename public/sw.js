/*
 * Service worker mínimo, escrito à mão.
 * - Pré-cache da página /offline e dos ícones.
 * - Arquivos estáticos com hash (/_next/static, /fonts, /icons): cache-first.
 * - Navegação: sempre rede; sem rede, mostra /offline. Páginas do app (dados
 *   pessoais) nunca são guardadas em cache.
 */
const VERSAO = "v1";
const CACHE_SHELL = `shell-${VERSAO}`;
const CACHE_ESTATICO = `estatico-${VERSAO}`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(nomes.filter((n) => n !== CACHE_SHELL && n !== CACHE_ESTATICO).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

function estatico(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icons/"))
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline", { cacheName: CACHE_SHELL })));
    return;
  }

  if (estatico(url)) {
    event.respondWith(
      caches.open(CACHE_ESTATICO).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
  }
});
