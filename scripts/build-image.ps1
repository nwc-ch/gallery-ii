$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"

Push-Location $backendDir
try {
  npm version patch --no-git-tag-version | Out-Null
  $version = (Get-Content "package.json" | ConvertFrom-Json).version
}
finally {
  Pop-Location
}

$imageName = "gallery-ii:$version"
docker build -t $imageName -t "gallery-ii:latest" $repoRoot

Write-Host "Built $imageName and gallery-ii:latest"
