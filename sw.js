// BatiCalc : service worker (fonctionnement hors ligne)
// Changez le numéro de version à chaque mise à jour du site.
var VERSION = "baticalc-v2";
var FICHIERS = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  // Paiement, licence et statistiques : toujours par internet, jamais en cache
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.indexOf("/api/") === 0 || url.pathname.indexOf("/_vercel/") === 0) { return; }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(function (rep) {
      if (rep && rep.ok) { var c2 = rep.clone(); caches.open(VERSION).then(function (c) { c.put("index.html", c2); }); }
      return rep;
    }).catch(function () { return caches.match("index.html"); }));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (cache) {
      var reseau = fetch(req).then(function (rep) {
        if (rep && rep.ok) { var copie = rep.clone(); caches.open(VERSION).then(function (c) { c.put(req, copie); }); }
        return rep;
      }).catch(function () { return cache || caches.match("index.html"); });
      return cache || reseau;
    })
  );
});
