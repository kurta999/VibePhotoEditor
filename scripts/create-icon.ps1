$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets'
$frames = @()
foreach ($size in @(16, 24, 32, 48, 64, 128, 256)) {
  $bitmap = [Drawing.Bitmap]::new($size, $size)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.ScaleTransform($size / 256.0, $size / 256.0)
  $rounded = [Drawing.Drawing2D.GraphicsPath]::new()
  $rounded.AddArc(8, 8, 108, 108, 180, 90)
  $rounded.AddArc(140, 8, 108, 108, 270, 90)
  $rounded.AddArc(140, 140, 108, 108, 0, 90)
  $rounded.AddArc(8, 140, 108, 108, 90, 90)
  $rounded.CloseFigure()
  $brush = [Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.Rectangle]::new(8, 8, 240, 240), [Drawing.ColorTranslator]::FromHtml('#f48b60'), [Drawing.ColorTranslator]::FromHtml('#df583b'), 90.0)
  $graphics.FillPath($brush, $rounded)
  $pen = [Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#fff8ef'), 13)
  $pen.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
  foreach ($coords in @(@(128,37,207,82.5,207,173.5,128,219,49,173.5,49,82.5), @(128,83,167,105.5,167,150.5,128,173,89,150.5,89,105.5))) {
    $points = for ($i = 0; $i -lt $coords.Length; $i += 2) { [Drawing.PointF]::new($coords[$i], $coords[$i+1]) }
    $graphics.DrawPolygon($pen, [Drawing.PointF[]]$points)
  }
  $stream = [IO.MemoryStream]::new()
  $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
  $frames += [PSCustomObject]@{ Size = $size; Bytes = $stream.ToArray() }
  if ($size -eq 256) { $bitmap.Save((Join-Path $assetPath 'icon.png'), [Drawing.Imaging.ImageFormat]::Png) }
  $stream.Dispose(); $pen.Dispose(); $brush.Dispose(); $rounded.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$output = [IO.File]::Create((Join-Path $assetPath 'icon.ico'))
$writer = [IO.BinaryWriter]::new($output)
try {
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
  $offset = 6 + 16 * $frames.Count
  foreach ($frame in $frames) {
    $dimension = if ($frame.Size -eq 256) { 0 } else { $frame.Size }
    $writer.Write([byte]$dimension); $writer.Write([byte]$dimension); $writer.Write([uint16]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$frame.Bytes.Length); $writer.Write([uint32]$offset)
    $offset += $frame.Bytes.Length
  }
  foreach ($frame in $frames) { $writer.Write([byte[]]$frame.Bytes) }
} finally { $writer.Dispose(); $output.Dispose() }
Write-Output 'Created assets/icon.ico (16-256 px) and assets/icon.png'
