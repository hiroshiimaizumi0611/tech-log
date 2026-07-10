const initializeMobileMenus = () => {
  document.querySelectorAll<HTMLElement>('[data-mobile-menu]').forEach((menu) => {
    if (menu.dataset.initialized === 'true') return;

    const trigger = menu.querySelector<HTMLButtonElement>('[data-mobile-menu-trigger]');
    const panel = menu.querySelector<HTMLElement>('[data-mobile-menu-panel]');
    if (!trigger || !panel) return;

    menu.dataset.initialized = 'true';

    const close = (restoreFocus = false) => {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', 'メニューを開く');
      panel.hidden = true;
      document.body.classList.remove('menu-open');
      if (restoreFocus) trigger.focus();
    };

    const open = () => {
      trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-label', 'メニューを閉じる');
      panel.hidden = false;
      document.body.classList.add('menu-open');
    };

    trigger.addEventListener('click', () => {
      if (trigger.getAttribute('aria-expanded') === 'true') close();
      else open();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
        close(true);
      }
    });

    panel.addEventListener('click', (event) => {
      if ((event.target as Element).closest('a')) close();
    });

    window.matchMedia('(min-width: 48rem)').addEventListener('change', (event) => {
      if (event.matches) close();
    });
  });
};

initializeMobileMenus();
document.addEventListener('astro:page-load', initializeMobileMenus);
