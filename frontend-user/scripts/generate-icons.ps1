Add-Type -AssemblyName System.Drawing

$iconsDir = Join-Path $PSScriptRoot "..\public\icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
}

$srcPath = Join-Path $PSScriptRoot "..\public\images\logo1.png"
$src = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath))

function Resize-Image {
    param(
        [System.Drawing.Image]$source,
        [int]$width,
        [int]$height,
        [string]$destFile,
        [double]$padPercent = 0.0,
        [System.Drawing.Color]$bgColor = [System.Drawing.Color]::Transparent
    )

    $bmp = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear($bgColor)
    
    if ($padPercent -gt 0) {
        $padW = [int]($width * $padPercent)
        $padH = [int]($height * $padPercent)
        $drawW = $width - (2 * $padW)
        $drawH = $height - (2 * $padH)
        $g.DrawImage($source, $padW, $padH, $drawW, $drawH)
    } else {
        $g.DrawImage($source, 0, 0, $width, $height)
    }
    $g.Dispose()
    
    $fullDest = Join-Path $iconsDir $destFile
    $bmp.Save($fullDest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $destFile"
}

Resize-Image -source $src -width 192 -height 192 -destFile "icon-192x192.png"
Resize-Image -source $src -width 512 -height 512 -destFile "icon-512x512.png"
Resize-Image -source $src -width 180 -height 180 -destFile "apple-touch-icon.png"
Resize-Image -source $src -width 32 -height 32 -destFile "favicon-32x32.png"
Resize-Image -source $src -width 16 -height 16 -destFile "favicon-16x16.png"

$brandBg = [System.Drawing.ColorTranslator]::FromHtml("#141518")
Resize-Image -source $src -width 192 -height 192 -destFile "icon-maskable-192x192.png" -padPercent 0.12 -bgColor $brandBg
Resize-Image -source $src -width 512 -height 512 -destFile "icon-maskable-512x512.png" -padPercent 0.12 -bgColor $brandBg

$src.Dispose()
Write-Host "All PWA icons generated successfully."
