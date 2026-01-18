# Reference-only helper script for downstream app projects.
# Not intended to be executed inside the mrdj-app-mcp repo itself.

param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$smartRoot = Join-Path $ProjectRoot "smartutilifyIconDownload"
$webSource = Join-Path $smartRoot "web"
$pwaSource = Join-Path $smartRoot "pwa"
$assetsIcons = Join-Path $ProjectRoot "assets/icons"
$publicIcons = Join-Path $ProjectRoot "public/icons"
$iconsRoot = Join-Path $ProjectRoot "icons"
$faviconTarget = Join-Path $ProjectRoot "favicon.ico"

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Copy-Dir([string]$Source, [string]$Destination) {
  if (Test-Path $Source) {
    Copy-Item (Join-Path $Source "*") -Destination $Destination -Recurse -Force
  } else {
    Write-Warning "Source missing: $Source"
  }
}

Ensure-Dir $publicIcons
Ensure-Dir $iconsRoot

# Copy icon sources into public/icons
Copy-Dir $assetsIcons $publicIcons
Copy-Dir $webSource $publicIcons
Copy-Dir $pwaSource $publicIcons

# Mirror public/icons -> icons (used by some web roots)
Copy-Dir $publicIcons $iconsRoot

# Copy favicon.ico to project root
$faviconSource = Join-Path $publicIcons "favicon.ico"
if (Test-Path $faviconSource) {
  Copy-Item $faviconSource -Destination $faviconTarget -Force
} else {
  Write-Warning "favicon.ico not found in $publicIcons"
}

Write-Host "Icon copy complete."
