<#
  Super Markdown launcher. Windows runs this when a Markdown file is double-clicked
  (or "Open with Super Markdown" is picked). It copies the file into a fresh copy of
  SuperMarkdown.html and opens that in the default browser.

  Written for Windows PowerShell 5.1 and to keep working in Constrained Language Mode
  (locked-down PCs): every .NET call has a plain-cmdlet fallback.
#>
param(
  [Parameter(Position = 0)][string]$Path,
  [switch]$NoLaunch   # tests: print the page path instead of opening it
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$app = Join-Path $here 'SuperMarkdown.html'
$viewDir = Join-Path $here 'view'

function Show-Page($file) {
  if ($NoLaunch) { Write-Output $file } else { Start-Process -FilePath $file }
}

function HtmlAttr([string]$s) {
  return $s.Replace('&', '&amp;').Replace('"', '&quot;').Replace('<', '&lt;').Replace('>', '&gt;')
}

function FileUrl([string]$dir) {
  $p = $dir.TrimEnd('\').Replace('\', '/') + '/'
  $p = $p -replace '%', '%25' -replace '#', '%23' -replace '\?', '%3F' -replace ' ', '%20'
  if ($p.StartsWith('//')) { return 'file:' + $p }   # \\server\share
  return 'file:///' + $p
}

try {
  if (-not $Path) { Show-Page $app; return }   # started without a file: the start page

  $item = Get-Item -LiteralPath $Path
  if ($item.PSIsContainer) { throw "That is a folder, not a file." }
  if ($item.Length -gt 60MB) { throw "The file is over 60 MB." }

  # bytes as base64 lets the page detect the encoding itself (UTF-8, UTF-16, Windows-1252)
  $enc = 'base64'
  try {
    $payload = [Convert]::ToBase64String([IO.File]::ReadAllBytes($item.FullName))
  } catch {
    $enc = 'text'
    $payload = Get-Content -LiteralPath $item.FullName -Raw -Encoding UTF8
    if ($null -eq $payload) { $payload = '' }
    # same reversible escape the page uses for its own embedded text
    $payload = $payload -replace '<(?=!--|/script)', ('<' + [char]0xE000)
  }

  $tag = '<script type="text/plain" id="boot-doc" data-enc="' + $enc + '" data-name="' + (HtmlAttr $item.Name) +
         '" data-path="' + (HtmlAttr $item.FullName) + '" data-base="' + (HtmlAttr (FileUrl $item.DirectoryName)) + '">' +
         $payload + '</script>'

  $html = Get-Content -LiteralPath $app -Raw -Encoding UTF8
  $marker = '<script type="text/markdown" id="sample-md">'
  if ($html.IndexOf($marker) -lt 0) { throw "SuperMarkdown.html looks damaged. Run the installer again." }
  $html = $html.Replace($marker, $tag + "`n" + $marker)

  if (-not (Test-Path -LiteralPath $viewDir)) { New-Item -ItemType Directory -Path $viewDir | Out-Null }
  # tidy pages from earlier days
  Get-ChildItem -LiteralPath $viewDir -Filter '*.html' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-2) } | Remove-Item -Force -ErrorAction SilentlyContinue

  # one page per source file: same name + a short hash of the full path
  $h = 7
  foreach ($c in $item.FullName.ToLower().ToCharArray()) { $h = ($h * 31 + [int]$c) % 2147483629 }
  $safe = $item.BaseName -replace '[^\w\-. ]', '_'
  if ($safe.Length -gt 60) { $safe = $safe.Substring(0, 60) }
  $out = Join-Path $viewDir ($safe + ' - ' + $h + '.html')

  try { [IO.File]::WriteAllText($out, $html) } catch { Set-Content -LiteralPath $out -Value $html -Encoding UTF8 }
  Show-Page $out
} catch {
  $msg = HtmlAttr ($_.Exception.Message)
  $file = HtmlAttr ([string]$Path)
  if (-not (Test-Path -LiteralPath $viewDir)) { New-Item -ItemType Directory -Path $viewDir | Out-Null }
  $err = Join-Path $viewDir 'error.html'
  Set-Content -LiteralPath $err -Encoding UTF8 -Value ('<!doctype html><meta charset="utf-8"><title>Super Markdown</title>' +
    '<body style="font:17px/1.6 system-ui;max-width:640px;margin:60px auto;padding:0 20px">' +
    '<h1 style="font-size:22px">Super Markdown could not open this file</h1>' +
    '<p><b>File:</b> ' + $file + '</p><p><b>Reason:</b> ' + $msg + '</p></body>')
  Show-Page $err
}
