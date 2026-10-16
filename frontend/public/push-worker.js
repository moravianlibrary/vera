// WATCH-push: shows a watchlist's push and opens its link when the notification is clicked. The
// server sends { title, body, url, tag } as the push's JSON payload.

self.addEventListener("push", (event) => {
  const push = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(push.title ?? "VERA", {
      body: push.body ?? "",
      tag: push.tag,
      data: { url: push.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/"));
});
