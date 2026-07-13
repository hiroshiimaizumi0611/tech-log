import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const fontFamily = `'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', system-ui, sans-serif`;

const defaultOg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#07090d"/>
  <circle cx="1040" cy="92" r="280" fill="#0b0f14" stroke="#202936" stroke-width="2"/>
  <path d="M170 177 77 270l93 93M288 177l93 93-93 93M270 137l-82 266" fill="none" stroke="#4ea1ff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="452" y="274" fill="#f5f7fa" font-family="system-ui, sans-serif" font-size="94" font-weight="750">テックログ</text>
  <text x="452" y="354" fill="#8cc5ff" font-family="system-ui, sans-serif" font-size="34" font-weight="600" letter-spacing="4">TECH LOG</text>
  <line x1="78" y1="492" x2="1122" y2="492" stroke="#202936" stroke-width="2"/>
  <text x="78" y="550" fill="#a6afbc" font-family="system-ui, sans-serif" font-size="30">つくる、動かす、改善する。</text>
</svg>`;

const pluginsArticleOg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#07090d"/>
  <circle cx="1080" cy="40" r="300" fill="#0b0f14" stroke="#202936" stroke-width="2"/>
  <text x="72" y="94" fill="#8cc5ff" font-family="${fontFamily}" font-size="28" font-weight="700" letter-spacing="3">CHATGPT CODEX</text>
  <text x="72" y="170" fill="#f5f7fa" font-family="${fontFamily}" font-size="56" font-weight="750">Pluginに含められるもの</text>
  <text x="74" y="220" fill="#a6afbc" font-family="${fontFamily}" font-size="28">必要な機能を選んで、ひとつにまとめる</text>

  <g transform="translate(72 282)">
    <rect width="312" height="190" rx="22" fill="#0b0f14" stroke="#4ea1ff" stroke-width="3"/>
    <circle cx="50" cy="50" r="22" fill="#4ea1ff"/>
    <path d="M40 50l7 7 14-16" fill="none" stroke="#07090d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="34" y="112" fill="#f5f7fa" font-family="${fontFamily}" font-size="42" font-weight="700">Skills</text>
    <text x="34" y="156" fill="#a6afbc" font-family="${fontFamily}" font-size="25">手順・知識</text>
  </g>
  <g transform="translate(444 282)">
    <rect width="312" height="190" rx="22" fill="#0b0f14" stroke="#202936" stroke-width="3"/>
    <circle cx="50" cy="50" r="22" fill="#202936"/>
    <path d="M40 50l7 7 14-16" fill="none" stroke="#8cc5ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="34" y="112" fill="#f5f7fa" font-family="${fontFamily}" font-size="42" font-weight="700">Apps</text>
    <text x="34" y="156" fill="#a6afbc" font-family="${fontFamily}" font-size="25">外部サービス接続</text>
  </g>
  <g transform="translate(816 282)">
    <rect width="312" height="190" rx="22" fill="#0b0f14" stroke="#202936" stroke-width="3"/>
    <circle cx="50" cy="50" r="22" fill="#202936"/>
    <path d="M40 50l7 7 14-16" fill="none" stroke="#8cc5ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="34" y="112" fill="#f5f7fa" font-family="${fontFamily}" font-size="37" font-weight="700">App Templates</text>
    <text x="34" y="156" fill="#a6afbc" font-family="${fontFamily}" font-size="25">設定の雛形</text>
  </g>

  <rect x="72" y="522" width="1056" height="2" fill="#202936"/>
  <text x="72" y="574" fill="#a6afbc" font-family="${fontFamily}" font-size="28">すべて必須ではありません。用途に応じて構成できます。</text>
</svg>`;

const outputs = [
  { path: resolve(here, '../public/og-default.png'), svg: defaultOg },
  {
    path: resolve(here, '../src/assets/blog/chatgpt-codex-plugins-og.png'),
    svg: pluginsArticleOg,
  },
];

await Promise.all(outputs.map(({ path, svg }) => sharp(Buffer.from(svg)).png().toFile(path)));
