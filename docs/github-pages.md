# Classic on GitHub Pages

Public URL: https://makaihurstjob-sys.github.io/alien-force-classic/
Publishing repository: makaihurstjob-sys/alien-force-classic (compiled assets only).
Development repository remains private.

Build with `npm run build:pages`. Output is `dist-pages/`; the relative asset URLs
support GitHub project subpaths. The standalone entry uses the same Classic
component, engine, renderer, and controls as the main application, with no backend.
The full application's normal build remains separate.

To update, build and test, then copy the new output to the publishing checkout,
remove obsolete assets there, preserve `.git` and `.nojekyll`, commit, and push main.
GitHub Pages publishes the root of main. Never put environment files or source maps
in the publishing repository.

Validation: production static build, 14 simulation tests, TypeScript, and an Edge
mobile smoke test at a project subpath passed. The browser check covers entry,
pause/resume, action controls, menu navigation, overflow, and runtime errors.
Run `node scripts/smoke-pages-local.mjs` with Playwright available; optionally set
PLAYWRIGHT_MODULE to the module's file URL. The test uses installed Microsoft Edge.
