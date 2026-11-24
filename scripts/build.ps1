param(
    [switch]$SelfContained,
    [switch]$SkipUiBuild,
    [switch]$NoRestore,
    [string]$OutputDir = (Join-Path $PSScriptRoot "..\dist")
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$uiDir = Join-Path $repoRoot "ui"
$csproj = Join-Path $repoRoot "src\Vellum\Vellum.csproj"
$icoPath = Join-Path $repoRoot "src\Vellum\Assets\vellum.ico"

function Resolve-DotNet8Exe {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Microsoft\dotnet\dotnet.exe"),
        "dotnet"
    )
    foreach ($cand in $candidates) {
        try {
            $sdks = & $cand --list-sdks 2>$null
            if ($sdks -match "^8\.") {
                return $cand
            }
        } catch {
            continue
        }
    }
    throw ".NET 8 SDK was not found. Install .NET 8 SDK to build Vellum."
}

$dotnetExe = Resolve-DotNet8Exe
Write-Host "Using .NET SDK host: $dotnetExe" -ForegroundColor Cyan

if (-not (Test-Path $icoPath)) {
    Write-Host "Generating Vellum icon..." -ForegroundColor Cyan
    & (Join-Path $PSScriptRoot "generate-icon.ps1") -OutputPath $icoPath
}

if (-not $SkipUiBuild) {
    Write-Host "Building frontend UI..." -ForegroundColor Cyan
    Push-Location $uiDir
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Frontend build failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
}

if (Test-Path $OutputDir) {
    Remove-Item (Join-Path $OutputDir "*") -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$scFlag = if ($SelfContained) { "true" } else { "false" }
Write-Host "Publishing Vellum.exe (SelfContained=$scFlag)..." -ForegroundColor Cyan

$publishArgs = @(
    "publish", $csproj,
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", $scFlag,
    "-p:PublishSingleFile=true",
    "-p:IncludeNativeLibrariesForSelfExtract=true",
    "-o", $OutputDir
)
if ($SelfContained) {
    $publishArgs += "-p:EnableCompressionInSingleFile=true"
}
if ($NoRestore) {
    $publishArgs += "--no-restore"
}

& $dotnetExe @publishArgs

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE"
}

Get-ChildItem (Join-Path $OutputDir "*") -Include "*.pdb","*.xml" -File | Remove-Item -Force -ErrorAction SilentlyContinue

$exeFile = Get-Item (Join-Path $OutputDir "Vellum.exe")
$sizeMb = [Math]::Round($exeFile.Length / 1MB, 2)
Write-Host "Built: $($exeFile.FullName) ($sizeMb MB)" -ForegroundColor Green
