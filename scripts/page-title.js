hexo.extend.filter.register('after_render:html', html =>
  html.replace(`<title>归档 | ${hexo.config.title}</title>`, `<title>${hexo.config.title}</title>`)
);
