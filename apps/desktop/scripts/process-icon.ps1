Add-Type -AssemblyName System.Drawing

$srcPath = Resolve-Path "$PSScriptRoot/../../web/app/favicon.ico"
$srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Host "Source Image: $($srcBmp.Width)x$($srcBmp.Height)"

$targetSize = 512
$squareBmp = New-Object System.Drawing.Bitmap($targetSize, $targetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($squareBmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$scale = [Math]::Min($targetSize / $srcBmp.Width, $targetSize / $srcBmp.Height)
$destW = [int]($srcBmp.Width * $scale)
$destH = [int]($srcBmp.Height * $scale)
$destX = [int](($targetSize - $destW) / 2)
$destY = [int](($targetSize - $destH) / 2)

$g.DrawImage($srcBmp, $destX, $destY, $destW, $destH)
$g.Dispose()
$srcBmp.Dispose()

$buildDir = Resolve-Path "$PSScriptRoot/../"
$buildPath = Join-Path $buildDir "build"
if (!(Test-Path $buildPath)) {
    New-Item -ItemType Directory -Path $buildPath | Out-Null
}
$publicPath = Join-Path $buildDir "public"

$destPngBuild = Join-Path $buildPath "icon.png"
$destPngPublic = Join-Path $publicPath "icon.png"

$squareBmp.Save($destPngBuild, [System.Drawing.Imaging.ImageFormat]::Png)
$squareBmp.Save($destPngPublic, [System.Drawing.Imaging.ImageFormat]::Png)
$squareBmp.Dispose()

Write-Host "Successfully generated square PNGs at $destPngBuild and $destPngPublic"
