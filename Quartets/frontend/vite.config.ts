// @ts-nocheck
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { resolve } from 'path';

const moduleExclude = match => {
	const m = id => id.indexOf(match) > -1;
	return {
		name: `exclude-${match}`,
		resolveId(id) {
			if (m(id)) return id;
		},
		load(id) {
			if (m(id)) return `export default {}`;
		},
	};
};

export default defineConfig({
	optimizeDeps: {
		include: [
			'gun',
			'gun/gun',
			'gun/sea',
			'gun/sea.js',
			'gun/lib/then',
			'gun/lib/webrtc',
			'gun/lib/radix',
			'gun/lib/radisk',
			'gun/lib/store',
			'gun/lib/rindexed',
		],
	},

	plugins: [solid(), moduleExclude('text-encoding')],
	resolve: { alias: { '@': resolve(__dirname, './src') } },
});
