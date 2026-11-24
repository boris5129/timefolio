$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $project
$runtime = Join-Path $project '.runtime'
New-Item -ItemType Directory -Force $runtime | Out-Null
$env:GRADLE_USER_HOME = Join-Path $project '.tools/gradle-home'
$env:npm_config_cache = Join-Path $project '.tools/npm-cache'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $project '.tools/browsers'
$nodeDir = Join-Path $project '.tools/node-v24.16.0-win-x64'
if (Test-Path "$nodeDir/npm.cmd") { $env:Path = "$nodeDir;$env:Path" }
if (!$env:JAVA_HOME -or !(Test-Path "$env:JAVA_HOME/bin/javac.exe")) {
    $jdk = Get-ChildItem "$env:USERPROFILE/.jdks" -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '(^|-)21\.' -and (Test-Path "$($_.FullName)/bin/javac.exe") } |
        Sort-Object Name -Descending | Select-Object -First 1
    if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
}
if ($env:JAVA_HOME) { $env:Path = "$env:JAVA_HOME/bin;$env:Path" }
function Run($Label, [scriptblock]$Command) {
    Write-Host "검증 및 실행 · $Label"
    & $Command
    if ($LASTEXITCODE) { throw "$Label 실패 (종료 코드 $LASTEXITCODE)" }
}
function Read-Process($Name) {
    $file = Join-Path $runtime "$Name.pid.json"
    if (!(Test-Path $file)) { return }
    $identity = Get-Content -Raw $file | ConvertFrom-Json
    $process = Get-Process -Id $identity.pid -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $identity.started) { return $process }
}
function Start-Tracked($Name, $Executable, $Arguments) {
    if ($Name -eq 'mysql') {
        $info = New-Object System.Diagnostics.ProcessStartInfo
        $info.FileName = '.tools/mysql-8.4.8-winx64/bin/mysqld.exe'
        $info.Arguments = $Arguments -join ' '
        $info.WorkingDirectory = $project
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $process = [Diagnostics.Process]::Start($info)
    } else {
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $project -PassThru -WindowStyle Hidden -RedirectStandardOutput "$runtime/$Name.out.log" -RedirectStandardError "$runtime/$Name.err.log"
    }
    @{pid=$process.Id; started=$process.StartTime.ToUniversalTime().Ticks.ToString()} | ConvertTo-Json | Set-Content "$runtime/$Name.pid.json"
    return $process
}
function Wait-Ready($Name, [scriptblock]$Probe) {
    for ($attempt=0; $attempt -lt 90; $attempt++) {
        if (!(Read-Process $Name)) { throw "$Name 시작 실패. .runtime의 로그를 확인해 주세요." }
        try { if (& $Probe) { return } } catch {}
        Start-Sleep -Seconds 1
    }
    throw "$Name 준비 시간 초과. .runtime의 로그를 확인해 주세요."
}
function Set-Database($Mode) {
    if ($Mode -eq 'app' -and (Test-Path '.env')) {
        foreach ($line in Get-Content '.env') {
            if ($line -match '^(TIMEFOLIO_(?:DB_URL|DB_USER|DB_PASSWORD|BIND|PORT))=(.*)$') {
                [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
            }
        }
    }
    if ($Mode -eq 'app' -and $env:TIMEFOLIO_DB_URL) { return }
    $bin = Join-Path $project '.tools/mysql-8.4.8-winx64/bin'
    $data = Join-Path $runtime 'mysql'
    $options = Join-Path $runtime 'mysql.ini'
    $credentials = Join-Path $runtime 'mysql-credentials.json'
    if (!(Test-Path $credentials)) {
        @{app=[guid]::NewGuid().ToString('N'); test=[guid]::NewGuid().ToString('N'); root=[guid]::NewGuid().ToString('N')} |
            ConvertTo-Json | Set-Content $credentials
    }
    $secret = Get-Content -Raw $credentials | ConvertFrom-Json
    if (!(Test-Path $data)) {
        Run '프로젝트 MySQL 초기화' { & "$bin/mysqld.exe" --no-defaults --initialize-insecure "--datadir=$data" }
    }
    if (!(Read-Process 'mysql')) {
        $null = Start-Tracked 'mysql' "$bin/mysqld.exe" @('--no-defaults', "--datadir=.runtime/mysql", "--basedir=.tools/mysql-8.4.8-winx64", '--port=33316', '--bind-address=127.0.0.1', '--mysqlx=OFF', '--character-set-server=utf8mb4', '--log-error=timefolio.err.log')
    }
    Wait-Ready 'mysql' {
        & "$bin/mysqladmin.exe" --no-defaults -h 127.0.0.1 -P 33316 ping 2>$null | Out-Null
        $LASTEXITCODE -eq 0
    }
    if (!(Test-Path "$runtime/mysql.ready")) {
        @"
CREATE DATABASE IF NOT EXISTS timefolio CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS timefolio_test CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'timefolio'@'127.0.0.1' IDENTIFIED BY '$($secret.app)';
GRANT ALL PRIVILEGES ON timefolio.* TO 'timefolio'@'127.0.0.1';
CREATE USER IF NOT EXISTS 'timefolio_test'@'127.0.0.1' IDENTIFIED BY '$($secret.test)';
GRANT ALL PRIVILEGES ON timefolio_test.* TO 'timefolio_test'@'127.0.0.1';
ALTER USER 'root'@'localhost' IDENTIFIED BY '$($secret.root)';
"@ | & "$bin/mysql.exe" --no-defaults -h 127.0.0.1 -P 33316 -u root
        if ($LASTEXITCODE) { throw '프로젝트 MySQL 계정 생성 실패' }
        New-Item -ItemType File "$runtime/mysql.ready" | Out-Null
    }
    $schema = if ($Mode -eq 'test') { 'timefolio_test' } else { 'timefolio' }
    $env:TIMEFOLIO_DB_URL = "jdbc:mysql://127.0.0.1:33316/${schema}?allowPublicKeyRetrieval=true&sslMode=DISABLED"
    $env:TIMEFOLIO_DB_USER = $schema
    $env:TIMEFOLIO_DB_PASSWORD = $secret.$Mode
}
function Start-App($Name, $Port) {
    $env:TIMEFOLIO_PORT = "$Port"
    $env:TIMEFOLIO_FRONTEND = (Join-Path $project 'frontend/dist').Replace('\','/')
    $jar = Get-ChildItem "$project/backend/build/libs" -Filter '*.jar' | Where-Object Name -NotLike '*-plain.jar' | Select-Object -First 1
    if (!$jar) { throw '백엔드 빌드 파일이 없습니다.' }
    if (!(Read-Process $Name)) { $null = Start-Tracked $Name (Get-Command java.exe).Source @('-jar', "`"$($jar.FullName)`"") }
    Wait-Ready $Name {
        (Invoke-WebRequest "http://127.0.0.1:$Port/api/auth/csrf" -TimeoutSec 2).StatusCode -eq 200
    }
}
