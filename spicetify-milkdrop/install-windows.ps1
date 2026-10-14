# One-step installer for Windows PowerShell
$ErrorActionPreference = "Stop"

$extDir = "$(spicetify path userdata)\Extensions"
if (-not (Test-Path $extDir)) {
    New-Item -ItemType Directory -Path $extDir | Out-Null
}

Write-Host "Copying milkdrop.js to $extDir..."
Copy-Item -Path ".\milkdrop.js" -Destination "$extDir\milkdrop.js" -Force

Write-Host "Configuring and applying Spicetify..."
spicetify config extensions milkdrop.js
spicetify apply

Write-Host "Installation complete! Press Ctrl+Shift+M inside Spotify to open MilkDrop."
