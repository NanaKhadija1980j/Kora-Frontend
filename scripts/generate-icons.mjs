/**
 * Generates PWA icons (192×192 and 512×512) from an inline SVG.
 * Run once: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../public/icons");

// Kora "K" logomark — teal on dark background, maskable-safe (icon within 80% safe zone)
function buildSvg(size) {
  const pad = Math.round(size * 0.1); // 10% padding for maskable safe zone
  const inner = size - pad * 2;
  const r = Math.round(inner * 0.22); // corner radius
  const fontSize = Math.round(inner * 0.52);
  const cx = size / 2;
  const cy = size / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#09090b"/>
  <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${r}" fill="#14b8a6"/>
  <text
    x="${cx}"
    y="${cy + fontSize * 0.36}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="#09090b"
    text-anchor="middle"
    dominant-baseline="auto"
  >K</text>
</svg>`;
}

async function generate(size, filename) {
  const svg = Buffer.from(buildSvg(size));
  await sharp(svg).png().toFile(join(OUT, filename));
  console.log(`✓ ${filename} (${size}×${size})`);
}

await generate(192, "icon-192.png");
await generate(512, "icon-512.png");

// Placeholder screenshots (solid color — replace with real screenshots before launch)
async function placeholder(w, h, filename) {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <rect width="${w}" height="${h}" fill="#09090b"/>
      <text x="${w/2}" y="${h/2}" font-family="sans-serif" font-size="32" fill="#14b8a6"
        text-anchor="middle" dominant-baseline="middle">Kora Protocol</text>
    </svg>`
  );
  await sharp(svg).png().toFile(join(OUT, filename));
  console.log(`✓ ${filename} (${w}×${h})`);
}

await placeholder(1280, 720, "screenshot-wide.png");
await placeholder(390, 844, "screenshot-narrow.png");

console.log("Icons generated successfully.");
