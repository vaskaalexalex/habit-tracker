import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const BASE = process.env.BASE_PATH ?? '';
const startUrl = `${BASE}/`;

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			strategies: 'generateSW',
			injectRegister: false,
			manifest: {
				name: 'Habit',
				short_name: 'Habit',
				description: 'Personal habit tracker — Sport, Coding, Reading, Journal',
				theme_color: '#22c55e',
				background_color: '#0f172a',
				id: startUrl,
				display: 'standalone',
				display_override: ['standalone'],
				orientation: 'portrait',
				start_url: startUrl,
				scope: startUrl,
				icons: [
					{ src: `${BASE}/icons/192.png`, sizes: '192x192', type: 'image/png' },
					{ src: `${BASE}/icons/512.png`, sizes: '512x512', type: 'image/png' },
					{
						src: `${BASE}/icons/maskable.png`,
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				cleanupOutdatedCaches: true,
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
				clientsClaim: true,
				navigateFallback: startUrl,
				skipWaiting: true,
				importScripts: [`${BASE || ''}/push-sw.js`],
				runtimeCaching: [
					{
						urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
						handler: 'NetworkOnly'
					},
					{
						urlPattern: ({ request }) =>
							request.destination === 'image' || request.destination === 'font',
						handler: 'CacheFirst',
						options: {
							cacheName: 'static-assets',
							expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
						}
					}
				]
			},
			devOptions: {
				enabled: false,
				type: 'module',
				navigateFallback: startUrl
			}
		})
	]
});
