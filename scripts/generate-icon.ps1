param(
    [string]$OutputPath = (Join-Path $PSScriptRoot "..\src\Vellum\Assets\vellum.ico")
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$outDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

function New-RoundedRectPath {
    param([float]$X, [float]$Y, [float]$W, [float]$H, [float]$R)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $R * 2.0
    $path.AddArc($X, $Y, $d, $d, 180, 90)
    $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
    $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
    $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-SheetPath {
    param([float]$L, [float]$T, [float]$R, [float]$B, [float]$Corner, [float]$Fold)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $Corner * 2.0
    $path.AddArc($L, $T, $d, $d, 180, 90)
    $path.AddLine($L + $Corner, $T, $R - $Fold, $T)
    $path.AddLine($R - $Fold, $T, $R, $T + $Fold)
    $path.AddLine($R, $T + $Fold, $R, $B - $Corner)
    $path.AddArc($R - $d, $B - $d, $d, $d, 0, 90)
    $path.AddArc($L, $B - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function Render-VellumPngBytes {
    param([int]$Size)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $s = $Size / 256.0

    # Background squircle
    $bgRect = New-Object System.Drawing.RectangleF((12 * $s), (12 * $s), (232 * $s), (232 * $s))
    $bgPath = New-RoundedRectPath -X $bgRect.X -Y $bgRect.Y -W $bgRect.Width -H $bgRect.Height -R (54 * $s)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(28 * $s, 16 * $s),
        [System.Drawing.PointF]::new(228 * $s, 240 * $s),
        [System.Drawing.Color]::FromArgb(255, 32, 39, 59),
        [System.Drawing.Color]::FromArgb(255, 17, 21, 33)
    )
    $g.FillPath($bgBrush, $bgPath)

    if ($Size -ge 24) {
        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(34, 255, 255, 255), [Math]::Max(1.0, 2.0 * $s))
        $g.DrawPath($borderPen, $bgPath)
        $borderPen.Dispose()
    }

    # Drop shadow under sheet
    $shadowPath = New-SheetPath -L (58 * $s) -T (39 * $s) -R (198 * $s) -B (219 * $s) -Corner (10 * $s) -Fold (44 * $s)
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(85, 0, 0, 0))
    $g.FillPath($shadowBrush, $shadowPath)

    # Ivory sheet
    $sheetPath = New-SheetPath -L (58 * $s) -T (34 * $s) -R (198 * $s) -B (214 * $s) -Corner (10 * $s) -Fold (44 * $s)
    $sheetBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(58 * $s, 34 * $s),
        [System.Drawing.PointF]::new(198 * $s, 214 * $s),
        [System.Drawing.Color]::FromArgb(255, 252, 249, 242),
        [System.Drawing.Color]::FromArgb(255, 237, 229, 213)
    )
    $g.FillPath($sheetBrush, $sheetPath)

    # Folded corner triangle
    $foldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $foldPath.AddPolygon([System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(154 * $s, 34 * $s),
        [System.Drawing.PointF]::new(198 * $s, 78 * $s),
        [System.Drawing.PointF]::new(164 * $s, 78 * $s),
        [System.Drawing.PointF]::new(154 * $s, 68 * $s)
    ))
    $foldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 219, 209, 190))
    $g.FillPath($foldBrush, $foldPath)

    # Terracotta bookmark ribbon
    $ribbonPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ribbonPath.AddPolygon([System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(84 * $s, 34 * $s),
        [System.Drawing.PointF]::new(105 * $s, 34 * $s),
        [System.Drawing.PointF]::new(105 * $s, 68 * $s),
        [System.Drawing.PointF]::new(94.5 * $s, 60 * $s),
        [System.Drawing.PointF]::new(84 * $s, 68 * $s)
    ))
    $ribbonBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 201, 89, 59))
    $g.FillPath($ribbonBrush, $ribbonPath)

    # Bold Cobalt V-Nib Emblem
    $vPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $vPath.AddPolygon([System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(83 * $s, 95 * $s),
        [System.Drawing.PointF]::new(104 * $s, 95 * $s),
        [System.Drawing.PointF]::new(128 * $s, 156 * $s),
        [System.Drawing.PointF]::new(152 * $s, 95 * $s),
        [System.Drawing.PointF]::new(173 * $s, 95 * $s),
        [System.Drawing.PointF]::new(137 * $s, 185 * $s),
        [System.Drawing.PointF]::new(119 * $s, 185 * $s)
    ))
    $vBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.PointF]::new(84 * $s, 95 * $s),
        [System.Drawing.PointF]::new(172 * $s, 185 * $s),
        [System.Drawing.Color]::FromArgb(255, 76, 110, 245),
        [System.Drawing.Color]::FromArgb(255, 43, 74, 199)
    )
    $g.FillPath($vBrush, $vPath)

    if ($Size -ge 48) {
        $holeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 250, 246, 238))
        $g.FillEllipse($holeBrush, (122 * $s), (120 * $s), (12 * $s), (12 * $s))
        $slitPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 250, 246, 238), [Math]::Max(1.2, 3.0 * $s))
        $slitPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $slitPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $g.DrawLine($slitPen, (128 * $s), (130 * $s), (128 * $s), (162 * $s))
        $holeBrush.Dispose()
        $slitPen.Dispose()
    }

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()

    $ms.Dispose()
    $vBrush.Dispose(); $vPath.Dispose()
    $ribbonBrush.Dispose(); $ribbonPath.Dispose()
    $foldBrush.Dispose(); $foldPath.Dispose()
    $sheetBrush.Dispose(); $sheetPath.Dispose()
    $shadowBrush.Dispose(); $shadowPath.Dispose()
    $bgBrush.Dispose(); $bgPath.Dispose()
    $g.Dispose(); $bmp.Dispose()

    return ,([byte[]]$bytes)
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$frames = @()
foreach ($sz in $sizes) {
    [byte[]]$png = Render-VellumPngBytes -Size $sz
    $frames += [PSCustomObject]@{ Size = $sz; Data = $png }
}

$fs = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR header (6 bytes)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1) # 1 = ICO
$bw.Write([UInt16]$frames.Count)

$offset = 6 + (16 * $frames.Count)
foreach ($f in $frames) {
    $dim = if ($f.Size -eq 256) { [byte]0 } else { [byte]$f.Size }
    $bw.Write($dim)                 # bWidth
    $bw.Write($dim)                 # bHeight
    $bw.Write([byte]0)              # bColorCount
    $bw.Write([byte]0)              # bReserved
    $bw.Write([UInt16]1)            # wPlanes
    $bw.Write([UInt16]32)           # wBitCount
    $bw.Write([UInt32]$f.Data.Length) # dwBytesInRes
    $bw.Write([UInt32]$offset)      # dwImageOffset
    $offset += $f.Data.Length
}

foreach ($f in $frames) {
    [byte[]]$bytes = $f.Data
    $bw.Write($bytes)
}

$bw.Flush()
$bw.Dispose()
$fs.Dispose()

$info = Get-Item $OutputPath
Write-Output "Generated icon: $($info.FullName) ($($info.Length) bytes, $($frames.Count) resolutions)"
