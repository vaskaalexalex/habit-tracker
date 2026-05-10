/* global self, clients */
self.addEventListener('push', function (event) {
	let data = { title: 'Habit', body: '', url: '/' };
	try {
		if (event.data) {
			const parsed = event.data.json();
			if (parsed && typeof parsed === 'object') data = { ...data, ...parsed };
		}
	} catch {
		try {
			const t = event.data && event.data.text();
			if (t) data.body = t;
		} catch {
			/* ignore */
		}
	}
	event.waitUntil(
		self.registration.showNotification(data.title, {
			body: data.body,
			icon: new URL('icons/192.png', self.location).href,
			badge: new URL('icons/192.png', self.location).href,
			data: { url: data.url || '/' },
			tag: 'habit-reminder',
			renotify: true
		})
	);
});

self.addEventListener('notificationclick', function (event) {
	event.notification.close();
	const url = (event.notification.data && event.notification.data.url) || '/';
	const abs = new URL(url, self.location.origin).href;
	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
			for (let i = 0; i < clientList.length; i++) {
				const c = clientList[i];
				if (c.url.startsWith(self.location.origin) && 'focus' in c) return c.focus();
			}
			if (clients.openWindow) return clients.openWindow(abs);
		})
	);
});
