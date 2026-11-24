. "$PSScriptRoot/web-node.ps1"
& $nodePath (Join-Path $root 'web/server.cjs')
exit $LASTEXITCODE
