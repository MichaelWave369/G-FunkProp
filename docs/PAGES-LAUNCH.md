# Publishing the G-BIOS flight deck on GitHub Pages

The project is a static, offline-first browser simulator. It does **not** need a backend, CDN, npm install, external APIs or Netlify.

## One-time setup (repository administrator)

1. Open [G-FunkProp settings → Pages](https://github.com/MichaelWave369/G-FunkProp/settings/pages).
2. Under **Build and deployment → Source**, choose **GitHub Actions**. Save if prompted.
3. Merge the PR containing `.github/workflows/pages.yml`, after reviewing the diff and required checks.
4. Open [Actions → Publish G-BIOS to GitHub Pages](https://github.com/MichaelWave369/G-FunkProp/actions/workflows/pages.yml). If a deployment has not run successfully, select **Run workflow**, branch **main**.
5. Wait for the **Validate and publish flight deck** job to pass. The deployed URL should be [michaelwave369.github.io/G-FunkProp/](https://michaelwave369.github.io/G-FunkProp/).

**Important:** GitHub Pages must be enabled for the repository before `actions/configure-pages@v5` can publish. The standard `GITHUB_TOKEN` does not have the administration permission to automatically enable Pages for a previously disabled repository. A failed Pages job before setup does not mean the model tests failed.

## Deployment boundaries

- Runs on updates to the four static app files or the Pages workflow on `main`, or on explicit manual workflow dispatch.
- Checks JavaScript syntax and runs `node tests/test-core.cjs` before publishing.
- Packages **only** `index.html`, `styles.css`, `core.js`, `app.js`. Tests, specs, workflows and other repository files are not part of the website.
- Permissions are limited to read repository contents, write Pages deployments and obtain an OpenID Connect token for deployment authentication.
- The Pages environment records the deployment address.
- There are no real spacecraft hardware controls, high-voltage interfaces or claims of experimental warp propulsion.

## Verify the live result

- Load the published URL on desktop or Quest/browser. Confirm the cockpit renders and all styles load.
- Click **ENGAGE THE GROOVE** to authorize browser audio. Keep volume low; infrasound and sub-bass can be inaudible on small speakers.
- Check both the engineering and fictional metric modes; they must stay clearly labeled.
- With the browser's network connection disconnected after initial load, an already-loaded page should continue simulating. For reliable *new* offline launches, use the downloaded files directly; this workflow does not install a service worker or promise offline caching.

## Troubleshooting

- **Configure GitHub Pages failed:** Check Settings → Pages → Source is **GitHub Actions**, then rerun the workflow on `main`.
- **404 on published URL:** Check Actions deployment status and allow GitHub to publish before treating the link as live.
- **Blank/unformatted page:** Check that all four expected static assets deployed at the same base URL; they use relative paths suitable for project Pages.
- **Audio silent:** Browsers require an explicit click to begin playback. Try the built-in tone at modest monitor volume; sub-bass can be outside speaker response.
- **Site is not offline after clearing cache:** Expected. The demo does not currently register a service worker; download the repository for a guaranteed offline entry point.
