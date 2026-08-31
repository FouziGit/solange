/* SOLANGE — service worker (lot 3).
   Rôle unique : recevoir les notifications push et ouvrir l'app au bon
   endroit. Aucune mise en cache : la stratégie de cache est une décision
   perf qui appartient au lot 6, et un cache mal réglé servirait du contenu
   périmé. Ce fichier doit rester à la racine pour couvrir tout le site. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* charge utile illisible : on affiche quand même quelque chose d'honnête */
  }
  const title = data.title || "SOLANGE";
  const body = data.body || "Du nouveau sur SOLANGE.";
  const link = data.link || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // même tag → remplace la notification précédente au lieu d'empiler
      tag: data.tag || "solange",
      // un regroupement ne re-vibre pas : il met à jour ce qui est affiché
      renotify: !data.count || data.count <= 1,
      data: { link },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  const url = new URL(link, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // onglet déjà ouvert : on le remet devant et on y navigue
        for (const client of clients) {
          if (
            client.url.startsWith(self.location.origin) &&
            "focus" in client
          ) {
            client.navigate?.(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
