param([switch]$Browser)
. "$PSScriptRoot/web-node.ps1"
foreach ($file in 'server.cjs','ledger.js','app.js') {
    & $nodePath --check (Join-Path $root "web/$file")
    if ($LASTEXITCODE) { exit $LASTEXITCODE }
}
& $nodePath --test (Join-Path $root 'tests/web/ledger.test.cjs')
if ($LASTEXITCODE) { exit $LASTEXITCODE }
if ($Browser) {
    $env:NODE_PATH = Join-Path $root 'frontend/node_modules'
    & $nodePath (Join-Path $root 'tests/web/browser.cjs')
    if ($LASTEXITCODE) { exit $LASTEXITCODE }
}
exit 0
