<#
  Removes Super Markdown: its files, its registry entries and its shortcut.
  File types it was the default for go back to what they were before.
#>
param([switch]$Quiet)
$ErrorActionPreference = 'SilentlyContinue'

$classes = 'HKCU:\Software\Classes'
$progId = 'SuperMarkdown.md'
$appKey = 'HKCU:\Software\SuperMarkdown'
$mdExts = @('.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdwn', '.mdx')
$verbExts = $mdExts + @('.txt')
$dest = Join-Path $env:LOCALAPPDATA 'Programs\SuperMarkdown'

$prev = Get-ItemProperty -LiteralPath "$appKey\PreviousDefaults"
function Remove-IfEmpty($key) {
  $k = Get-Item -LiteralPath $key
  if ($k -and $k.ValueCount -eq 0 -and $k.SubKeyCount -eq 0) { Remove-Item -LiteralPath $key -Force }
}

foreach ($ext in $mdExts) {
  Remove-ItemProperty -LiteralPath "$classes\$ext\OpenWithProgids" -Name $progId
  $p = Get-ItemProperty -LiteralPath "$classes\$ext"
  if ($p -and [string]$p.'(default)' -eq $progId) {
    $old = ''
    if ($prev) { $old = [string]$prev.$ext }
    if ($old) { Set-ItemProperty -LiteralPath "$classes\$ext" -Name '(default)' -Value $old }
    else { & "$env:SystemRoot\System32\reg.exe" delete "HKCU\Software\Classes\$ext" /ve /f 2>&1 | Out-Null }   # PowerShell cannot delete a default value
  }
  # leave no empty keys behind for extensions that had nothing before
  Remove-IfEmpty "$classes\$ext\OpenWithProgids"
  Remove-IfEmpty "$classes\$ext"
  # a remembered "Always use Super Markdown" would point at nothing once it is gone
  $ucKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\UserChoice"
  $uc = Get-ItemProperty -LiteralPath $ucKey
  if ($uc -and $uc.ProgId -eq $progId) { Remove-Item -LiteralPath $ucKey -Recurse -Force }
}
foreach ($ext in $verbExts) { Remove-Item -LiteralPath "$classes\SystemFileAssociations\$ext\shell\SuperMarkdown" -Recurse -Force }
Remove-Item -LiteralPath "$classes\$progId" -Recurse -Force
Remove-ItemProperty -LiteralPath 'HKCU:\Software\RegisteredApplications' -Name 'Super Markdown'
Remove-Item -LiteralPath $appKey -Recurse -Force
Remove-Item -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SuperMarkdown' -Recurse -Force
Remove-Item -LiteralPath (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Super Markdown.lnk') -Force

Remove-Item -LiteralPath $dest -Recurse -Force
if (Test-Path -LiteralPath $dest) {
  # something still holds a file (an open browser page is fine): finish once this window closes
  Start-Process -FilePath "$env:SystemRoot\System32\cmd.exe" -ArgumentList ('/c timeout /t 3 >nul & rd /s /q "' + $dest + '"') -WindowStyle Hidden
}
try { Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\ie4uinit.exe') -ArgumentList '-show' -WindowStyle Hidden } catch { }

Write-Host ''
Write-Host '  Super Markdown has been removed.' -ForegroundColor Green
Write-Host ''
if (-not $Quiet) { Start-Sleep -Seconds 3 }
