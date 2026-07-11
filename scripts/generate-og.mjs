import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, '../public/og-default.png');
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#07090d"/>
  <circle cx="1040" cy="92" r="280" fill="#0b0f14" stroke="#202936" stroke-width="2"/>
  <path d="M170 177 77 270l93 93M288 177l93 93-93 93M270 137l-82 266" fill="none" stroke="#4ea1ff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="452" y="274" fill="#f5f7fa" font-family="system-ui, sans-serif" font-size="94" font-weight="750">テックログ</text>
  <text x="452" y="354" fill="#8cc5ff" font-family="system-ui, sans-serif" font-size="34" font-weight="600" letter-spacing="4">TECH LOG</text>
  <line x1="78" y1="492" x2="1122" y2="492" stroke="#202936" stroke-width="2"/>
  <text x="78" y="550" fill="#a6afbc" font-family="system-ui, sans-serif" font-size="30">つくる、動かす、改善する。</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(output);
