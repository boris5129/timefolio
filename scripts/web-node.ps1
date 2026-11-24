$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = Get-Command node.exe -ErrorAction SilentlyContinue
$portableNode = Join-Path $root '.tools/node-v24.16.0-win-x64/node.exe'
if ($node) { $nodePath = $node.Source }
elseif (Test-Path $portableNode) { $nodePath = $portableNode }
else { throw 'Node.js 22 이상을 설치해 주세요.' }
