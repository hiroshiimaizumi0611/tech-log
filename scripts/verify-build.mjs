import { access, readFile } from 'node:fs/promises';

await access(new URL('../dist/index.html', import.meta.url));
await access(new URL('../dist/pagefind/pagefind.js', import.meta.url));

const entry = JSON.parse(await readFile(new URL('../dist/pagefind/pagefind-entry.json', import.meta.url), 'utf8'));
const japaneseIndex = entry.languages?.ja;
if (!japaneseIndex?.hash || japaneseIndex.page_count < 1) {
  throw new Error('Pagefindの日本語インデックスが生成されていません');
}
await access(new URL(`../dist/pagefind/pagefind.${japaneseIndex.hash}.pf_meta`, import.meta.url));
