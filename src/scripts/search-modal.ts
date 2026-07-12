interface PagefindResultData {
  url: string;
  excerpt?: string;
  plain_excerpt?: string;
  meta?: Record<string, string>;
}

interface PagefindSearchResult {
  data: () => Promise<PagefindResultData>;
}

interface PagefindModule {
  init: () => Promise<void>;
  search: (query: string) => Promise<{ results: PagefindSearchResult[] }>;
}

const DEBOUNCE_MS = 150;
const RESULT_LIMIT = 8;

const appendHighlightedText = (element: HTMLElement, text: string, query: string) => {
  const terms = query
    .trim()
    .split(/\s+/u)
    .map((term) => term.toLocaleLowerCase())
    .filter(Boolean);
  const lowerText = text.toLocaleLowerCase();
  let cursor = 0;

  while (cursor < text.length) {
    let nextIndex = -1;
    let nextTerm = '';
    for (const term of terms) {
      const index = lowerText.indexOf(term, cursor);
      if (index >= 0 && (nextIndex < 0 || index < nextIndex)) {
        nextIndex = index;
        nextTerm = term;
      }
    }

    if (nextIndex < 0) {
      element.append(document.createTextNode(text.slice(cursor)));
      return;
    }
    if (nextIndex > cursor) element.append(document.createTextNode(text.slice(cursor, nextIndex)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(nextIndex, nextIndex + nextTerm.length);
    element.append(mark);
    cursor = nextIndex + nextTerm.length;
  }
};

const safeResultUrl = (value: string) => {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || !['http:', 'https:'].includes(url.protocol)) return '/blog/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/blog/';
  }
};

const initSearchModal = (root: HTMLElement) => {
  if (root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const trigger = root.querySelector<HTMLButtonElement>('[data-search-trigger]');
  const dialog = root.querySelector<HTMLDialogElement>('[data-search-dialog]');
  const closeButton = root.querySelector<HTMLButtonElement>('[data-search-close]');
  const form = root.querySelector<HTMLFormElement>('[data-search-form]');
  const input = root.querySelector<HTMLInputElement>('[data-search-input]');
  const summary = root.querySelector<HTMLElement>('[data-search-summary]');
  const results = root.querySelector<HTMLElement>('[data-search-results]');
  if (!trigger || !dialog || !closeButton || !form || !input || !summary || !results) return;

  let debounceTimer: number | undefined;
  let requestId = 0;
  let pagefindPromise: Promise<PagefindModule> | undefined;

  const loadPagefind = () => {
    pagefindPromise ??= (async () => {
      // Pagefind is generated only after Astro finishes, so Vite must leave this browser import unresolved.
      // @ts-expect-error The generated browser bundle has no source-time TypeScript declaration.
      const pagefind = (await import(/* @vite-ignore */ '/pagefind/pagefind.js')) as PagefindModule;
      await pagefind.init();
      return pagefind;
    })();
    return pagefindPromise;
  };

  const showFailure = () => {
    requestId += 1;
    summary.textContent = '検索を読み込めませんでした';
    results.replaceChildren();
    const fallback = document.createElement('p');
    fallback.className = 'search-dialog__error';
    fallback.append(document.createTextNode('検索を読み込めませんでした'));
    fallback.append(document.createElement('br'));
    const link = document.createElement('a');
    link.href = '/blog/';
    link.textContent = '記事一覧を見る';
    fallback.append(link);
    results.append(fallback);
  };

  const renderResults = (items: PagefindResultData[], query: string, total: number) => {
    results.replaceChildren();
    summary.textContent = `${total}件の結果`;
    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'search-dialog__empty';
      empty.textContent = '該当する記事はありません';
      results.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const link = document.createElement('a');
      link.className = 'search-result';
      link.href = safeResultUrl(item.url);

      const title = document.createElement('span');
      title.className = 'search-result__title';
      appendHighlightedText(title, item.meta?.title || '無題の記事', query);
      link.append(title);

      const excerptText = item.plain_excerpt || item.excerpt || '';
      if (excerptText) {
        const excerpt = document.createElement('p');
        excerpt.className = 'search-result__excerpt';
        appendHighlightedText(excerpt, excerptText, query);
        link.append(excerpt);
      }
      fragment.append(link);
    }
    results.append(fragment);
  };

  const isCurrentSearch = (generation: number, query: string) => dialog.open && generation === requestId && input.value.trim() === query;

  const search = async (query: string, generation: number) => {
    if (!isCurrentSearch(generation, query)) return;

    summary.textContent = '検索中…';
    try {
      const pagefind = await loadPagefind();
      const response = await pagefind.search(query);
      const data = await Promise.all(response.results.slice(0, RESULT_LIMIT).map((result) => result.data()));
      if (!isCurrentSearch(generation, query)) return;
      renderResults(data, query, response.results.length);
    } catch (error) {
      console.error('Pagefind search failed', error);
      if (isCurrentSearch(generation, query)) showFailure();
    }
  };

  const close = () => {
    if (dialog.open) dialog.close();
  };

  trigger.addEventListener('click', () => {
    dialog.showModal();
    document.body.classList.add('search-open');
    input.focus({ preventScroll: true });
    void loadPagefind().catch((error) => {
      console.error('Pagefind initialization failed', error);
      if (dialog.open) showFailure();
    });
  });

  closeButton.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('close', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = undefined;
    requestId += 1;
    input.value = '';
    summary.textContent = 'キーワードを入力してください';
    results.replaceChildren();
    document.body.classList.remove('search-open');
    trigger.focus({ preventScroll: true });
  });
  form.addEventListener('submit', (event) => event.preventDefault());
  input.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    const generation = ++requestId;
    const query = input.value.trim();
    results.replaceChildren();
    if (!query) {
      summary.textContent = 'キーワードを入力してください';
      return;
    }
    summary.textContent = '検索中…';
    debounceTimer = window.setTimeout(() => void search(query, generation), DEBOUNCE_MS);
  });
};

document.querySelectorAll<HTMLElement>('[data-search-modal]').forEach(initSearchModal);
