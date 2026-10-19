import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve('public');
const read = file => readFile(path.join(root, file), 'utf8');

test('build contains the blog routes, real counts, pagination and local search data', async () => {
  for (const route of ['index.html', 'archives/index.html', 'tags/index.html', 'categories/index.html', 'about/index.html', 'page/2/index.html', 'posts/css-grid-notes/index.html']) {
    assert.match(await read(route), /<title>[^<]+<\/title>/);
  }
  const index = await read('index.html');
  assert.match(index, /loseheart的博客/);
  assert.match(index, /\/images\/jade-pond.png/);
  assert.equal((index.match(/class="recent-post-item(?:\s|")/g) || []).length, 3);
  const search = await read('search.xml');
  assert.ok((search.match(/<entry>/g) || []).length >= 4);
  assert.match(search, /CSS Grid/);
});

test('every generated local page, image, stylesheet and script reference resolves', async () => {
  const pages = (await readdir(root, { recursive: true })).filter(name => name.endsWith('.html'));
  let checked = 0;
  for (const page of pages) {
    const html = await read(page);
    for (const [, ref] of html.matchAll(/(?:href|src)="([^"<>]+)"/g)) {
      if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue;
      const url = new URL(ref.replaceAll('&amp;', '&'), `https://blog.test/${page}`);
      let candidate = path.join(root, decodeURIComponent(url.pathname));
      assert.ok(candidate.startsWith(`${root}${path.sep}`), `${page}: invalid path ${ref}`);
      let info;
      try {
        info = await stat(candidate);
        if (info.isDirectory()) {
          candidate = path.join(candidate, 'index.html');
          info = await stat(candidate);
        }
      } catch {
        assert.fail(`${page}: broken reference ${ref}`);
      }
      assert.ok(info.isFile(), `${page}: not a file ${ref}`);
      checked++;
    }
  }
  assert.ok(checked > 100);
});

test('local icon fonts and library licenses are included in the generated site', async () => {
  const stylesheet = 'vendor/fontawesome/css/all.min.css';
  const css = await read(stylesheet);
  const urls = [...css.matchAll(/url\(["']?([^)'"\s]+)/g)];
  assert.ok(urls.length > 0);
  for (const [, ref] of urls) {
    const file = path.resolve(root, path.dirname(stylesheet), ref.split('?')[0]);
    assert.ok((await stat(file)).size > 0, `Missing icon font: ${ref}`);
  }
  assert.match(await read('vendor/typed/LICENSE'), /MIT License/);
  assert.match(await read('vendor/fontawesome/LICENSE.txt'), /License/);
  const manifest = JSON.parse(await read('vendor/manifest.json'));
  for (const asset of manifest) {
    const bytes = await readFile(path.join(root, 'vendor', asset.file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  }
});
