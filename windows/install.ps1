<#
  Super Markdown installer for Windows. Per-user: no admin rights, nothing outside your own profile.
  Run it again any time to update. Remove it from Settings > Apps, or with "Uninstall Super Markdown.cmd".
#>
param([switch]$Quiet)
$ErrorActionPreference = 'Stop'

$src = $PSScriptRoot
$dest = Join-Path $env:LOCALAPPDATA 'Programs\SuperMarkdown'
$classes = 'HKCU:\Software\Classes'
$progId = 'SuperMarkdown.md'
$appKey = 'HKCU:\Software\SuperMarkdown'
$mdExts = @('.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdwn', '.mdx')
$verbExts = $mdExts + @('.txt')

# create the key only if missing: New-Item -Force on an existing key wipes its values
function Set-Value($key, $name, $value, $type = 'String') {
  if (-not (Test-Path -LiteralPath $key)) { New-Item -Path $key -Force | Out-Null }
  New-ItemProperty -LiteralPath $key -Name $name -Value $value -PropertyType $type -Force | Out-Null
}
function Get-Default($key) {
  $p = Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
  if ($p) { return [string]$p.'(default)' }
  return ''
}

Write-Host ''
Write-Host '  Installing Super Markdown...' -ForegroundColor Cyan

# 1. files
if (-not (Test-Path -LiteralPath $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
foreach ($f in @('SuperMarkdown.html', 'open.ps1', 'uninstall.ps1', 'supermarkdown.ico', 'Welcome.md')) {
  Copy-Item -LiteralPath (Join-Path $src $f) -Destination $dest -Force
}
Get-ChildItem -LiteralPath $dest -File | ForEach-Object { try { Unblock-File -LiteralPath $_.FullName } catch { } }

$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$open = Join-Path $dest 'open.ps1'
$icon = Join-Path $dest 'supermarkdown.ico'
$cmd = '"' + $ps + '" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $open + '" "%1"'

# 2. the document type Windows hands to the launcher
Set-Value "$classes\$progId" '(default)' 'Markdown document'
Set-Value "$classes\$progId" 'FriendlyTypeName' 'Markdown document'
Set-Value "$classes\$progId\DefaultIcon" '(default)' $icon
Set-Value "$classes\$progId\Application" 'ApplicationName' 'Super Markdown'
Set-Value "$classes\$progId\Application" 'ApplicationIcon' $icon
Set-Value "$classes\$progId\Application" 'ApplicationDescription' 'Read Markdown files, formatted.'
Set-Value "$classes\$progId\shell\open" 'FriendlyAppName' 'Super Markdown'
Set-Value "$classes\$progId\shell\open" 'Icon' $icon
Set-Value "$classes\$progId\shell\open\command" '(default)' $cmd

# 3. Markdown extensions: list it under "Open with", and make it the default where nothing else is chosen
$chosenElsewhere = @()
foreach ($ext in $mdExts) {
  Set-Value "$classes\$ext\OpenWithProgids" $progId '' 'String'
  $uc = Get-ItemProperty -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\UserChoice" -ErrorAction SilentlyContinue
  if ($uc -and $uc.ProgId -and $uc.ProgId -ne $progId) { $chosenElsewhere += $ext; continue }
  if ($uc) { continue }   # already Super Markdown
  $prev = Get-Default "$classes\$ext"
  if ($prev -ne $progId) {
    Set-Value "$appKey\PreviousDefaults" $ext $prev
    Set-Value "$classes\$ext" '(default)' $progId
  }
}

# 4. right-click "Open with Super Markdown" (on Windows 11 it sits under "Show more options")
foreach ($ext in $verbExts) {
  $verb = "$classes\SystemFileAssociations\$ext\shell\SuperMarkdown"
  Set-Value $verb '(default)' 'Open with Super Markdown'
  Set-Value $verb 'Icon' $icon
  Set-Value "$verb\command" '(default)' $cmd
}

# 5. show up in Settings > Default apps
Set-Value "$appKey\Capabilities" 'ApplicationName' 'Super Markdown'
Set-Value "$appKey\Capabilities" 'ApplicationDescription' 'Read Markdown files, formatted.'
Set-Value "$appKey\Capabilities" 'ApplicationIcon' $icon
foreach ($ext in $mdExts) { Set-Value "$appKey\Capabilities\FileAssociations" $ext $progId }
Set-Value 'HKCU:\Software\RegisteredApplications' 'Super Markdown' 'Software\SuperMarkdown\Capabilities'
Set-Value $appKey 'InstallDir' $dest

# 6. Settings > Apps entry, so it can be removed like any program
$un = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SuperMarkdown'
Set-Value $un 'DisplayName' 'Super Markdown'
Set-Value $un 'DisplayIcon' $icon
Set-Value $un 'DisplayVersion' '{{VERSION}}'
Set-Value $un 'Publisher' 'weellio'
Set-Value $un 'InstallLocation' $dest
Set-Value $un 'URLInfoAbout' 'https://github.com/weellio/supermarkdown'
Set-Value $un 'UninstallString' ('"' + $ps + '" -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $dest 'uninstall.ps1') + '"')
Set-Value $un 'NoModify' 1 'DWord'
Set-Value $un 'NoRepair' 1 'DWord'
Set-Value $un 'EstimatedSize' ([int]((Get-Item -LiteralPath (Join-Path $dest 'SuperMarkdown.html')).Length / 1KB) + 50) 'DWord'

# 7. Start menu shortcut to the start page (skipped quietly where COM is locked down)
try {
  $lnk = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Super Markdown.lnk'
  $sc = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
  $sc.TargetPath = Join-Path $dest 'SuperMarkdown.html'
  $sc.IconLocation = $icon
  $sc.Description = 'Read Markdown files, formatted.'
  $sc.Save()
} catch { }

# 8. let Explorer pick up the new icons
try { Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\ie4uinit.exe') -ArgumentList '-show' -WindowStyle Hidden } catch { }

Write-Host ''
Write-Host '  Super Markdown is installed.' -ForegroundColor Green
Write-Host ''
Write-Host '    Right-click a .md file  ->  Open with Super Markdown'
Write-Host '    Start menu              ->  Super Markdown'
Write-Host ''

if ($chosenElsewhere.Count -gt 0) {
  Write-Host ('  ' + ($chosenElsewhere -join ', ') + ' files open with another app right now.') -ForegroundColor Yellow
  Write-Host '  To double-click them into Super Markdown:'
  Write-Host '    1. Pick  Super Markdown  in the window that opens next.'
  Write-Host '    2. Tick  "Always use this app".'
  Write-Host '    3. Click OK.'
  Write-Host ''
  if (-not $Quiet) {
    Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\rundll32.exe') -ArgumentList ('shell32.dll,OpenAs_RunDLL ' + (Join-Path $dest 'Welcome.md'))
  }
} else {
  Write-Host '  Double-click any .md file to open it.' -ForegroundColor Green
  Write-Host ''
}
