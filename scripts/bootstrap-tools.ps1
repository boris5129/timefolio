$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
New-Item -ItemType Directory -Force .tools | Out-Null
function Get-Archive($Url, $Name, $Marker) {
    if (Test-Path ".tools/$Marker") { return }
    $archive = ".tools/$Name.zip"
    curl.exe -fsSL --retry 2 $Url -o $archive
    if ($LASTEXITCODE) { throw "다운로드 실패 ($Name)" }
    tar.exe -xf $archive -C .tools
    if ($LASTEXITCODE -or !(Test-Path ".tools/$Marker")) { throw "압축 해제 실패 ($Name)" }
    Remove-Item -LiteralPath $archive
}
Get-Archive 'https://nodejs.org/dist/v24.16.0/node-v24.16.0-win-x64.zip' 'node' 'node-v24.16.0-win-x64/npm.cmd'
Get-Archive 'https://services.gradle.org/distributions/gradle-8.14.4-bin.zip' 'gradle' 'gradle-8.14.4/bin/gradle.bat'
Get-Archive 'https://cdn.mysql.com/archives/mysql-8.4/mysql-8.4.8-winx64.zip' 'mysql' 'mysql-8.4.8-winx64/bin/mysqld.exe'
