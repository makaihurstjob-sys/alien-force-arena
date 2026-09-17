param([Parameter(Mandatory=$true)][string]$PublishCheckout)
$ErrorActionPreference = 'Stop'
# Use the separate public assets repository, never the source checkout.
$target = (Resolve-Path -LiteralPath $PublishCheckout).Path
$remote = git -C $target remote get-url origin
if ($remote -ne 'https://github.com/makaihurstjob-sys/alien-force-classic.git') { throw 'Unexpected publishing repository' }
if (git -C $target status --porcelain) { throw 'Publishing checkout must be clean' }
git -C $target pull --ff-only origin main
if ($LASTEXITCODE) { throw 'Publishing pull failed' }
npm run build:pages
if ($LASTEXITCODE) { throw 'Build failed' }
Copy-Item -Path 'dist-pages/*' -Destination $target -Recurse -Force
git -C $target add --all
git -C $target diff --cached --quiet
if ($LASTEXITCODE -eq 0) { Write-Output 'Public build is already current'; exit 0 }
$revision = git rev-parse --short HEAD
git -C $target commit -m "Publish Alien Force from source $revision"
if ($LASTEXITCODE) { throw 'Publish commit failed' }
git -C $target push origin main
if ($LASTEXITCODE) { throw 'Publish push failed' }
