. "$PSScriptRoot/common.ps1"
$testProcess = Read-Process 'test-app'
if (!$testProcess) { throw '검증 서버가 실행 중이어야 합니다.' }
Stop-Process -Id $testProcess.Id
if (!$testProcess.WaitForExit(10000)) { throw '검증 서버 종료 시간이 초과되었습니다.' }
Set-Database test
$env:TIMEFOLIO_BIND = '127.0.0.1'
Start-App 'test-app' 18080
