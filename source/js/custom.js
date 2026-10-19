document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main');
  if (main) {
    main.id ||= 'main-content';
    main.tabIndex = -1;
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = `#${main.id}`;
    skip.textContent = '跳到正文';
    document.body.prepend(skip);
  }

  // Butterfly's icon-only and span controls need keyboard names and activation.
  document.querySelectorAll('button[title], a[title]').forEach(control => {
    if (!control.getAttribute('aria-label')) {
      control.setAttribute('aria-label', control.title);
    }
  });

  const menu = document.querySelector('#toggle-menu');
  const drawer = document.querySelector('#sidebar-menus');
  const controls = document.querySelectorAll('#toggle-menu, #search-button, #scroll-down, .menus_item > .group, .copy-button, .highlight-tools > .expand');
  controls.forEach(control => {
    control.setAttribute('role', 'button');
    control.tabIndex = 0;
    if (control.id === 'toggle-menu') control.setAttribute('aria-label', '打开导航菜单');
    if (control.id === 'search-button') control.setAttribute('aria-label', '搜索文章');
    if (control.id === 'scroll-down') control.setAttribute('aria-label', '浏览文章');
    if (control.classList.contains('copy-button')) control.setAttribute('aria-label', '复制代码');
    if (control.classList.contains('expand')) control.setAttribute('aria-label', '折叠或展开代码');
    control.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (control.id === 'search-button') control.querySelector('.search')?.click();
        else control.click();
      }
    });
  });

  const prepareSearch = () => {
    const dialog = document.querySelector('#local-search .search-dialog');
    if (!dialog) return false;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', '搜索文章');
    dialog.querySelector('input').setAttribute('aria-label', '搜索文章');
    dialog.querySelector('.search-close-button').setAttribute('aria-label', '关闭搜索');
    return true;
  };
  prepareSearch();
  new MutationObserver(() => {
    prepareSearch();
    document.querySelector('.exit-readmode')?.setAttribute('aria-label', '退出阅读模式');
  }).observe(document.body, { childList: true });

  if (menu && drawer) {
    menu.setAttribute('aria-controls', drawer.id);
    const drawerControls = () => [...drawer.querySelectorAll('a[href], [tabindex="0"]')]
      .filter(control => control.getClientRects().length);
    const sync = () => {
      const open = drawer.classList.contains('open');
      menu.setAttribute('aria-expanded', String(open));
      drawer.inert = !open;
      if (open) drawerControls()[0]?.focus();
    };
    sync();
    new MutationObserver(sync).observe(drawer, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && drawer.classList.contains('open')) {
        document.querySelector('#menu-mask')?.click();
        menu.focus();
      }
      if (event.key === 'Tab' && drawer.classList.contains('open')) {
        const items = drawerControls();
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    });
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Typed.js is initialized asynchronously by the theme.
    const subtitle = document.querySelector('#subtitle');
    if (subtitle) {
      const showStaticSubtitle = () => {
        window.typed?.destroy();
        subtitle.textContent = '记一点技术，也记一点生活。';
      };
      const observer = new MutationObserver(() => {
        if (!window.typed) return;
        observer.disconnect();
        showStaticSubtitle();
      });
      observer.observe(subtitle, { childList: true, characterData: true, subtree: true });
      if (window.typed) {
        observer.disconnect();
        showStaticSubtitle();
      }
    }
  }
});
