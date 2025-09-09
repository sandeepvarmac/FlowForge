# Batch-extract text, images, and page renders from all PDFs in repo
# Output structure: extracted/<relative dir>/<pdf name without ext>/{text.txt, images/, pages/, info.txt}

param(
  [string]$Root = (Get-Location).Path,
  [string]$OutRoot = (Join-Path (Get-Location).Path 'extracted'),
  [int]$Dpi = 150,
  [string]$PopplerBin
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($PopplerBin) {
  if (-not (Test-Path -LiteralPath $PopplerBin)) {
    throw "PopplerBin path not found: $PopplerBin"
  }
  Write-Host "Prepending Poppler bin to PATH: $PopplerBin"
  $env:Path = "$PopplerBin;" + $env:Path
}

function Require-Tool([string]$name, [string]$hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required tool '$name' not found on PATH. Hint: $hint"
  }
}

function Detect-PageRenderer {
  if (Get-Command pdftopng -ErrorAction SilentlyContinue) {
    return 'pdftopng'
  }
  if (Get-Command pdftoppm -ErrorAction SilentlyContinue) {
    # Check if pdftoppm supports -png (Poppler)
    $help = (& pdftoppm -h) 2>&1 | Out-String
    if ($help -match "-png") { return 'pdftoppm-png' }
    return 'pdftoppm-ppm'
  }
  throw "No page renderer found: install Xpdf (pdftopng) or Poppler (pdftoppm)."
}

function PdfImagesMode {
  # Prefer Poppler's -all if supported, otherwise fall back to -j (Xpdf)
  $help = (& pdfimages -h) 2>&1 | Out-String
  if ($help -match "-all") { return 'all' }
  return 'j'
}

function Ensure-Dir([string]$p) {
  if (-not (Test-Path -LiteralPath $p)) {
    New-Item -ItemType Directory -Path $p | Out-Null
  }
}

function RelPath([string]$full, [string]$root) {
  $full = [IO.Path]::GetFullPath($full)
  $root = [IO.Path]::GetFullPath($root)
  if ($full.StartsWith($root)) { return $full.Substring($root.Length).TrimStart('\','/') }
  return $full
}

function Append-IndexRow {
  param(
    [string]$IndexCsv,
    [string]$RelPdf,
    [int]$Pages,
    [int]$ImageCount,
    [long]$TextBytes,
    [string]$Title
  )
  $header = 'RelativePdf,Pages,Images,TextBytes,Title'
  if (-not (Test-Path -LiteralPath $IndexCsv)) {
    $header | Out-File -FilePath $IndexCsv -Encoding UTF8
  }
  $safeTitle = ($Title -replace '"','''')
  $line = '"{0}",{1},{2},{3},"{4}"' -f $RelPdf, $Pages, $ImageCount, $TextBytes, $safeTitle
  Add-Content -Path $IndexCsv -Value $line -Encoding UTF8
}

Write-Host "Scanning for PDFs under $Root ..."
$pdfs = Get-ChildItem -Path $Root -Recurse -File -Include *.pdf
if (-not $pdfs) {
  Write-Warning 'No PDF files found.'
  exit 0
}

Ensure-Dir $OutRoot
$renderer = $null
try {
  Require-Tool -name 'pdftotext' -hint 'Install Poppler/Xpdf; ensure bin is on PATH.'
  Require-Tool -name 'pdfimages' -hint 'Install Poppler/Xpdf; ensure bin is on PATH.'
  Require-Tool -name 'pdfinfo'   -hint 'Install Poppler/Xpdf; ensure bin is on PATH.'
  $renderer = Detect-PageRenderer
} catch {
  Write-Error $_.Exception.Message
  Write-Host "PATH currently: $env:Path"
  exit 1
}
$imgMode = PdfImagesMode
$indexCsv = Join-Path $OutRoot 'index.csv'

foreach ($pdf in $pdfs) {
  try {
    $rel = RelPath $pdf.FullName $Root
    $relDir = Split-Path $rel -Parent
    $base = [IO.Path]::GetFileNameWithoutExtension($rel)
    $outDir = Join-Path (Join-Path $OutRoot $relDir) $base
    $imgDir = Join-Path $outDir 'images'
    $pageDir = Join-Path $outDir 'pages'
    $textPath = Join-Path $outDir 'text.txt'
    $infoPath = Join-Path $outDir 'info.txt'

    Ensure-Dir $outDir
    Ensure-Dir $imgDir
    Ensure-Dir $pageDir

    Write-Host "\nProcessing: $rel" -ForegroundColor Cyan

    # Metadata
    & pdfinfo -- "$($pdf.FullName)" 2>$null | Out-File -FilePath $infoPath -Encoding UTF8

    # Extract text (layout preserved)
    & pdftotext -layout -nopgbrk -enc UTF-8 -- "$($pdf.FullName)" "$textPath"

    # Extract embedded images
    if ($imgMode -eq 'all') {
      & pdfimages -all "$($pdf.FullName)" (Join-Path $imgDir 'image')
    } else {
      & pdfimages -j "$($pdf.FullName)" (Join-Path $imgDir 'image')
    }

    # Render pages to PNG for quick visual review
    switch ($renderer) {
      'pdftopng' {
        & pdftopng -r $Dpi "$($pdf.FullName)" (Join-Path $pageDir 'page') | Out-Null
      }
      'pdftoppm-png' {
        & pdftoppm -png -r $Dpi "$($pdf.FullName)" (Join-Path $pageDir 'page') | Out-Null
      }
      'pdftoppm-ppm' {
        # Fallback: produce PPM files if PNG not supported
        & pdftoppm -r $Dpi "$($pdf.FullName)" (Join-Path $pageDir 'page') | Out-Null
      }
    }

    # Collate stats for index
    $pages = 0
    $title = ''
    if (Test-Path -LiteralPath $infoPath) {
      $info = Get-Content -LiteralPath $infoPath -Raw
      if ($info -match "Pages:\s+(\d+)") { $pages = [int]$Matches[1] }
      if ($info -match "Title:\s+(.+)") { $title = $Matches[1].Trim() }
    }
    $imgCount = (Get-ChildItem -Path $imgDir -File -ErrorAction SilentlyContinue | Measure-Object).Count
    $textBytes = (Test-Path -LiteralPath $textPath) ? (Get-Item -LiteralPath $textPath).Length : 0

    Append-IndexRow -IndexCsv $indexCsv -RelPdf $rel -Pages $pages -ImageCount $imgCount -TextBytes $textBytes -Title $title

  } catch {
    Write-Warning ("Failed to process {0}: {1}" -f $pdf.FullName, $_.Exception.Message)
    continue
  }
}

Write-Host "\nDone. Outputs under: $OutRoot"
Write-Host "Index: $indexCsv"
