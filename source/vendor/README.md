Local browser assets:

- Font Awesome Free 7.3.1: https://github.com/FortAwesome/Font-Awesome/tree/7.3.1
  - Unmodified `css/all.min.css` and the four `webfonts/*.woff2` resources it references.
  - License: `fontawesome/LICENSE.txt` (icons CC BY 4.0, fonts SIL OFL 1.1, code MIT).
- Typed.js 2.1.0: https://github.com/mattboldt/typed.js
  - Unmodified npm distribution file `dist/typed.umd.js`, served locally.
  - License: `typed/LICENSE` (MIT).

Vendored assets are committed so a new install does not need the full icon SVG package or an external CDN at runtime. Recheck CSS font references and licenses when updating; `npm test` verifies that referenced fonts are present.
