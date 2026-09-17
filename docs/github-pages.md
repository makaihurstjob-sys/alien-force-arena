# Public Alien Force testing

Public URL: https://makaihurstjob-sys.github.io/alien-force-classic/
Source: makaihurstjob-sys/alien-force-arena-redux, branch main.
Published assets: makaihurstjob-sys/alien-force-classic, branch main.

The owner authorized main as the ongoing integration and public testing branch.
Commit tested source updates to main and push origin main. Publish the matching
static build as part of each update; a source push alone does not deploy Pages.
Run from the source repository:

```powershell
./scripts/publish-pages.ps1 -PublishCheckout "../alien-force-public-release"
```

The script validates the publishing remote and clean checkout, pulls main,
builds, copies only compiled output, commits and pushes the public assets.
No private server credentials or environment files belong in the public repo.
VITE Supabase URL and publishable key are public client configuration.
Verify the Pages deployment and public URL after publishing.

The static entry now includes the shared responsive menu, Classic, Practice,
and Supabase rooms. The base path is /alien-force-classic/ and invite links
preserve it. The generated 404.html allows direct Classic/Practice navigation
on GitHub Pages (the host may return HTTP 404 while the app renders).

Test with separate browsers/devices: create, share, join, ready, leave, and
host closure. Browser profiles share an anonymous identity between their tabs;
separate devices should have separate identities regardless of IP or Tailscale.
Rooms currently support lobby testing only, not synchronized multiplayer combat.
