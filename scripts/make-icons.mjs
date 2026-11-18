// Genereert de PNG-iconen uit static/icon.svg. Gebruik: node scripts/make-icons.mjs
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const svg = await readFile(new URL('../static/icon.svg', import.meta.url));

// Maskable: vlak volledig gevuld; het motief blijft binnen de veilige zone (80% in het midden).
const maskableSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
	<rect width="512" height="512" fill="#6C47FF"/>
	<path d="M256 150 360 262H298V362H214V262H152Z" fill="#FFC53D" stroke="#FFC53D" stroke-width="16" stroke-linejoin="round"/>
</svg>`);

const out = new URL('../static/icons/', import.meta.url);
await mkdir(out, { recursive: true });

const targets = [
	['icon-192.png', svg, 192],
	['icon-512.png', svg, 512],
	['icon-maskable-512.png', maskableSvg, 512],
	['apple-touch-icon.png', svg, 180]
];

for (const [name, source, size] of targets) {
	await sharp(source, { density: 384 })
		.resize(size, size)
		.flatten({ background: '#0B0E1A' })
		.png()
		.toFile(fileURLToPath(new URL(name, out)));
	console.log(`static/icons/${name}`);
}

