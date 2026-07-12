const RESET_DELAY = 2_000;

export function initializeCodeCopy(root: ParentNode = document): void {
  for (const pre of root.querySelectorAll<HTMLElement>('[data-article-body] pre')) {
    if (pre.dataset.copyInitialized === 'true') continue;
    const code = pre.querySelector<HTMLElement>('code');
    if (!code) continue;

    pre.dataset.copyInitialized = 'true';
    const toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';
    toolbar.dataset.codeToolbar = '';

    const filename = code.dataset.filename ?? pre.dataset.filename;
    if (filename) {
      const label = document.createElement('span');
      label.dataset.codeFilename = '';
      label.textContent = filename;
      toolbar.append(label);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.codeCopy = '';
    button.setAttribute('aria-live', 'polite');
    button.textContent = 'コピー';
    toolbar.append(button);
    pre.prepend(toolbar);

    let resetTimer: number | undefined;
    button.addEventListener('click', async () => {
      window.clearTimeout(resetTimer);
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
        await navigator.clipboard.writeText(code.textContent ?? '');
        button.textContent = 'コピーしました';
      } catch {
        button.textContent = 'コピーできませんでした';
      }
      resetTimer = window.setTimeout(() => {
        button.textContent = 'コピー';
      }, RESET_DELAY);
    });
  }
}

initializeCodeCopy();
document.addEventListener('astro:page-load', () => initializeCodeCopy());
