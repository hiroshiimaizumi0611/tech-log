import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));

const knownJapaneseFonts = {
  darwin: [
    {
      family: 'Hiragino Sans',
      path: '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
    },
  ],
  linux: [
    {
      family: 'Noto Sans CJK JP',
      path: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    },
    {
      family: 'Noto Sans JP',
      path: '/usr/share/fonts/opentype/noto/NotoSansJP-Regular.otf',
    },
  ],
  win32: [
    {
      family: 'Yu Gothic',
      path: 'C:\\Windows\\Fonts\\YuGothR.ttc',
    },
  ],
};

export const selectJapaneseFont = async (candidates = knownJapaneseFonts[process.platform] ?? []) => {
  for (const candidate of candidates) {
    try {
      await access(candidate.path, constants.R_OK);
      const metadata = await stat(candidate.path);
      if (metadata.isFile()) return candidate;
    } catch {
      // Try the next known font file.
    }
  }

  const expected = candidates.map(({ family, path }) => `${family} at ${path}`).join(', ') || `no known font path for ${process.platform}`;
  throw new Error(`[generate-chatgpt-sites-og] Japanese font unavailable. Expected a readable regular font file: ${expected}.`);
};

const buildSvg = (fontFamily) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M32 0H0V32" fill="none" stroke="#17304d" stroke-width="1" opacity="0.32"/>
      <circle cx="1" cy="1" r="1.2" fill="#3978bd" opacity="0.38"/>
    </pattern>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#111b28"/>
      <stop offset="1" stop-color="#090e15"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#2f80ff"/>
      <stop offset="1" stop-color="#51d8ef"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="#05080d"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <circle cx="1080" cy="96" r="250" fill="#0a2a50" opacity="0.2"/>
  <circle cx="110" cy="550" r="230" fill="#0a263d" opacity="0.18"/>

  <text x="64" y="72" fill="#72c8ff" font-family="${fontFamily}" font-size="24" font-weight="700" letter-spacing="3">CHATGPT SITES / HANDS-ON</text>
  <text x="64" y="142" fill="#f5f8fc" font-family="${fontFamily}" font-size="52" font-weight="760">ChatGPT Sitesで</text>
  <text x="64" y="206" fill="#f5f8fc" font-family="${fontFamily}" font-size="52" font-weight="760">Webサイトを作る</text>
  <text x="66" y="252" fill="#9eabba" font-family="${fontFamily}" font-size="25">指示から限定公開までを、ひとつずつ確認</text>

  <g transform="translate(646 58)">
    <rect x="-4" y="-4" width="500" height="258" rx="24" fill="#1677ff" opacity="0.13" filter="url(#glow)"/>
    <rect width="492" height="250" rx="22" fill="url(#panel)" stroke="#58718c" stroke-width="2"/>
    <circle cx="28" cy="27" r="5" fill="#75869a"/>
    <circle cx="47" cy="27" r="5" fill="#75869a"/>
    <circle cx="66" cy="27" r="5" fill="#75869a"/>
    <rect x="96" y="19" width="304" height="16" rx="8" fill="#1b2634"/>
    <line x1="18" y1="52" x2="474" y2="52" stroke="#30445a" stroke-width="2"/>
    <rect x="28" y="79" width="190" height="18" rx="9" fill="#53647a"/>
    <rect x="28" y="112" width="150" height="12" rx="6" fill="#34465b"/>
    <rect x="28" y="136" width="184" height="7" rx="3.5" fill="#26384c"/>
    <rect x="28" y="153" width="156" height="7" rx="3.5" fill="#26384c"/>
    <rect x="28" y="188" width="90" height="28" rx="14" fill="url(#accent)"/>
    <rect x="252" y="76" width="210" height="140" rx="12" fill="#101d2c" stroke="#2b4764" stroke-width="2"/>
    <path d="M272 190l54-58 36 34 34-43 46 67Z" fill="#29435f"/>
    <circle cx="411" cy="104" r="13" fill="#4fa9ff" opacity="0.62"/>
  </g>

  <g font-family="${fontFamily}" text-anchor="middle">
    <path d="M110 415H1090" fill="none" stroke="#1d5fae" stroke-width="3"/>
    <g fill="#07111d" stroke="#3f93ff" stroke-width="3">
      <circle cx="110" cy="415" r="38"/><circle cx="355" cy="415" r="38"/><circle cx="600" cy="415" r="38"/><circle cx="845" cy="415" r="38"/><circle cx="1090" cy="415" r="38"/>
    </g>
    <g fill="#72dff2" font-size="24" font-weight="800">
      <text x="110" y="424">1</text><text x="355" y="424">2</text><text x="600" y="424">3</text><text x="845" y="424">4</text><text x="1090" y="424">5</text>
    </g>
    <g fill="#dfe9f4" font-size="28" font-weight="700">
      <text x="110" y="482">指示</text><text x="355" y="482">プレビュー</text><text x="600" y="482">修正</text><text x="845" y="482">保存</text><text x="1090" y="482">限定公開</text>
    </g>
  </g>

  <rect x="64" y="525" width="1072" height="70" rx="18" fill="#09121d" stroke="#203b58" stroke-width="2"/>
  <text x="600" y="570" text-anchor="middle" fill="#f4f8fc" font-family="${fontFamily}" font-size="32" font-weight="700">指示 → プレビュー → 修正 → 保存 → 限定公開</text>
</svg>`;

export const generateChatgptSitesOg = async (outputPath = resolve(here, '../src/assets/blog/chatgpt-sites-guide-og.png')) => {
  const japaneseFont = await selectJapaneseFont();
  const fontFamily = `'${japaneseFont.family}', sans-serif`;

  return sharp(Buffer.from(buildSvg(fontFamily)))
    .png()
    .toFile(outputPath);
};

const entrypoint = process.argv[1];
if (entrypoint && pathToFileURL(resolve(entrypoint)).href === import.meta.url) {
  await generateChatgptSitesOg();
}
