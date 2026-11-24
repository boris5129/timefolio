. "$PSScriptRoot/web-node.ps1"
& $nodePath --version
if ($LASTEXITCODE) { exit $LASTEXITCODE }
Write-Host '별도 의존성 설치 없이 scripts/start.ps1로 실행할 수 있습니다.'
