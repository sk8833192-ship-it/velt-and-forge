# Wedding monogram generator

Implementation plan: write generator contract tests first; build normalized pure SVG geometry and conservative physical estimates; reuse that artwork inside three local preview scenes and a 1080px canvas export; copy the existing storefront header/footer; add a bounded Studio receiver; run all requested checks and a browser smoke test where available.

`monogram.js` is a classic browser script and a CommonJS module for tests. Letterforms are outlined paths with no font dependency. SVG downloads contain a white background and black vector marks; scene gradients and lighting never enter production artwork. The three weight settings use 14, 17 and 20 viewBox units (0.70, 0.85 and 1.00mm at 50mm). Long subtitle spacing can still need review. The pill estimates minimum stroke and subtitle clearance; Studio provides the raster geometry check and workshop proof review remains necessary.

The Studio button uses same-tab navigation so sessionStorage survives reliably. If browser storage is blocked (including some file URL policies), the tool offers a free SVG download and Studio falls back to its wedding demo. No network request, account, or external font is required.

Run `node --check site/tools/monogram.js`, `node --check studio/app.js`, `node site/tools/tests/monogram.test.cjs`, `node studio/tests/engine.test.cjs`, and `node studio/tests/studio.test.cjs` from the project root. XML validation in tests uses Python 3's standard library; the browser tool has no dependencies.
