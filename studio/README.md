# VELT & FORGE

Open **index.html** directly in Chrome for the free local Studio. No installation, build, server, font download, or account is needed. Keep the JavaScript/CSS files beside the HTML. Free artwork checking and proof generation stay on the device. On Cloudflare Pages, the Order Review dialog discovers configured payment methods; artwork is transmitted only when you submit a payment order. Direct file access and GitHub Pages stay in preview mode without payment API requests.

The studio includes three original SVG test designs, PNG/JPG/SVG upload and drop, a physically calibrated pixel checker, three interactive normal-mapped material previews, live pricing, a configuration dialog, and mirrored SVG/PNG factory proofs. Drag the preview to adjust its angle and light; arrow keys provide the same controls and Home resets the view.

## Geometry and production files

- Analysis and compensated artwork share a 512 × 512 binary mask. White/transparent borders are removed and all visible artwork is fitted within a circular die with a safety margin.
- The checker uses an exact Euclidean distance transform on a half-pixel boundary lattice, then rolling-disk opening to flag locally thin metal and narrow cavities. Unbounded exterior space is excluded from cavity scoring.
- Ice: minimum 0.50mm stroke / 0.80mm cavity. Vegetable-tanned leather: 0.40 / 0.65mm. Hardwood: 0.55 / 0.90mm.
- Compensation is a Euclidean disk dilation with a **radial** offset: +0.25mm can add 0.50mm to a stroke’s total width. It can also close cavities. Candidate fixes are evaluated against both defects before being offered; comparisons yield between scans so controls remain usable.
- Score is a transparent geometric heuristic: `100 − 68√(thin metal fraction) − 32√(narrow cavity fraction)`, clamped to 0–100; empty artwork scores zero. It estimates geometry, rather than thermal transfer, pressure, or manufacturing approval. Sampling limits and material variability still require a workshop proof.
- Die preview and production art are mirrored; ice and leather show the readable impression. SVG uses real millimeters and vector run paths, with separate labeled groups for non-machining guides/notes. Artwork has no font dependency. The SVG is a dimensional manufacturing proof, not a CNC machine toolpath.
- PNG has exactly 2048 × 2048 binary artwork pixels inside an annotated 2428 × 2560 proof. The dimension label specifies scale; arbitrary PNG DPI metadata must not be used for toolpath sizing. Download the JSON alongside the proof for the exact configuration.
- SVG upload accepts self-contained, static shapes and text with local fonts. External resources, style blocks, embedded images, animation, scripts, entities and active content are rejected. Export a plain SVG with outlined text for best consistency. PNG/JPG are decoded locally. Files are limited to 12MB / 80 megapixels.

## Pricing and checkout

USD prices are $69 / $89 / $109 for 38 / 50 / 63mm, +$15 for a 304 stainless die, +$18 for a stainless handle, and +$49 for a second interchangeable head. Walnut and arbor handles are included. The backend independently validates the configuration and calculates the same itemized price.

Cloudflare Pages Functions support PayPal Orders v2 and optional Stripe Checkout. PayPal orders can retain the mirrored SVG and order records in a private R2 bucket. The receipt includes a local proof backup; SVGs above the optional 200 KiB upload limit remain intact locally for manual delivery. Stripe currently creates Checkout Sessions; reconcile payment and artwork manually before fulfillment. See [the payment and domain runbook](../deploy/PAYMENT_AND_DOMAIN_RUNBOOK.md) for sandbox setup, live shipping-date gates, storage, and launch checks.

Claims follow the pre-launch evidence boundaries in `../seo_brand_blueprint.md`: "lead-free brass option (batch sheet published before dispatch)", "deep CNC engraving (≥2.8mm target)", and made-to-order production. Publish verified business/material/dispatch details and an actual estimated ship date before live checkout; the code does not establish certification or underwriting approval.

## Verification

```sh
node --check studio/app.js
node --check studio/engine.js
node --check studio/renderer.js
node --test studio/tests/*.test.cjs
```

Run from the project root. Geometry tests cover exact distances, Euclidean dilation, odd/even near-threshold strokes and cavities, size effects, exterior exclusion, empty input, mirrored coordinates, physical export dimensions and XML escaping. UI fixture tests exercise live configuration, tuning, modes, summary/exports and rapid upload ownership. The DOM fixture does not claim to test native image decoding or visual browser output.

An optional full real-browser runner, `python3 studio/tests/browser_smoke.py`, exercises offline file loading, all designs/modes, native PNG/JPG/SVG decode, invalid SVG handling, preview dragging, exported file contents, summary JSON and mobile overflow. It writes screenshots and proofs to a temporary QA folder and requires developer-only Python Playwright and Pillow. `--browser-path` selects an existing Chrome executable.

The current managed sandbox blocked native Chromium startup (`bootstrap_check_in: Permission denied`) and the browser bridge daemon was unavailable. Browser screenshot/decoding verification could not run in this environment; syntax, static HTML checks and Node tests were run successfully.
