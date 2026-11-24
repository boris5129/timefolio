. "$PSScriptRoot/web-node.ps1"

$chrome = @(
    "$env:ProgramFiles/Google/Chrome/Application/chrome.exe"
    "${env:ProgramFiles(x86)}/Google/Chrome/Application/chrome.exe"
    "$env:LOCALAPPDATA/Google/Chrome/Application/chrome.exe"
) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (!$chrome) { throw 'Google Chrome을 찾을 수 없습니다. Chrome을 설치해 주세요.' }

$url = 'http://127.0.0.1:4173/'
function Test-Timefolio {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content.Contains('<title>Timefolio</title>')
    } catch { return $false }
}

if (!(Test-Timefolio)) {
    $env:TIMEFOLIO_WEB_PORT = '4173'
    $server = Join-Path $root 'web/server.cjs'
    $process = Start-Process -FilePath $nodePath -ArgumentList ('"' + $server + '"') -WorkingDirectory $root -WindowStyle Hidden -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (Test-Timefolio) { $ready = $true; break }
        if ($process.HasExited) { break }
        Start-Sleep -Milliseconds 250
    }
    if (!$ready) { throw 'Timefolio를 시작하지 못했습니다. 4173번 포트를 확인해 주세요.' }
}

Start-Process -FilePath $chrome -ArgumentList $url
