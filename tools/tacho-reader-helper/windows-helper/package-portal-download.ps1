[CmdletBinding()]
param(
    [string]$Runtime = 'win-x64',
    [string]$Configuration = 'Release',
    [string]$OutputRoot,
    [switch]$FrameworkDependent,
    [string]$CertificateThumbprint,
    [string]$TimestampUrl,
    [string]$SignToolPath,
    [switch]$SkipPublish
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [IO.Path]::GetFullPath((Join-Path $scriptRoot '..\..\..'))
$projectPath = Join-Path $scriptRoot 'HourWise.TachoReaderHelper.csproj'

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $repoRoot 'public\downloads\tacho-reader-helper'
}

function Get-HelperVersion {
    $programPath = Join-Path $scriptRoot 'Program.cs'
    $match = Select-String -LiteralPath $programPath -Pattern 'public const string Version = "([^"]+)"' | Select-Object -First 1
    if ($null -eq $match) { throw 'Could not read HelperConstants.Version from Program.cs.' }
    return $match.Matches[0].Groups[1].Value
}

function Get-SigningCertificate([string]$Thumbprint) {
    $normalized = ($Thumbprint -replace '\s', '').ToUpperInvariant()
    foreach ($store in @('Cert:\CurrentUser\My', 'Cert:\LocalMachine\My')) {
        $cert = Get-ChildItem -Path $store -ErrorAction SilentlyContinue |
            Where-Object { ($_.Thumbprint -replace '\s', '').ToUpperInvariant() -eq $normalized } |
            Select-Object -First 1
        if ($null -ne $cert) { return $cert }
    }

    throw "Certificate thumbprint was not found in CurrentUser\My or LocalMachine\My: $Thumbprint"
}

function Invoke-AuthenticodeSign {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate
    )

    if (-not [string]::IsNullOrWhiteSpace($SignToolPath)) {
        if (-not (Test-Path -LiteralPath $SignToolPath -PathType Leaf)) {
            throw "SignToolPath does not exist: $SignToolPath"
        }

        $args = @('sign', '/fd', 'SHA256', '/sha1', $Certificate.Thumbprint)
        if (-not [string]::IsNullOrWhiteSpace($TimestampUrl)) {
            $args += @('/tr', $TimestampUrl, '/td', 'SHA256')
        }
        $args += $Path
        & $SignToolPath @args
        if ($LASTEXITCODE -ne 0) {
            throw "signtool failed for $Path with exit code $LASTEXITCODE."
        }
        return
    }

    $signParams = @{
        FilePath = $Path
        Certificate = $Certificate
        HashAlgorithm = 'SHA256'
    }
    if (-not [string]::IsNullOrWhiteSpace($TimestampUrl)) {
        $signParams.TimestampServer = $TimestampUrl
    }

    $signature = Set-AuthenticodeSignature @signParams
    if ($signature.Status -ne 'Valid') {
        throw "Signing failed for $Path. Status: $($signature.Status). Message: $($signature.StatusMessage)"
    }
}

$helperVersion = Get-HelperVersion
$packageBaseName = "HourWise.TachoReaderHelper-$helperVersion-$Runtime"
$stagingRoot = Join-Path $scriptRoot "obj\portal-package\$packageBaseName"
$publishedAppPath = Join-Path $stagingRoot 'app'
$outputRootFull = [IO.Path]::GetFullPath($OutputRoot)
$versionedZipPath = Join-Path $outputRootFull "$packageBaseName.zip"
$latestZipPath = Join-Path $outputRootFull "HourWise.TachoReaderHelper-$Runtime-latest.zip"
$createdAtUtc = [DateTimeOffset]::UtcNow.ToString('O')

if (-not $SkipPublish) {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $publishedAppPath, $outputRootFull | Out-Null

    $publishArgs = @(
        'publish',
        $projectPath,
        '--configuration', $Configuration,
        '--runtime', $Runtime,
        '--output', $publishedAppPath,
        '--self-contained', ($(if ($FrameworkDependent) { 'false' } else { 'true' })),
        '-p:PublishSingleFile=true',
        '-p:IncludeNativeLibrariesForSelfExtract=true',
        '-p:PublishReadyToRun=false',
        '-p:DebugType=None',
        '-p:DebugSymbols=false'
    )

    & dotnet @publishArgs
    if ($LASTEXITCODE -ne 0) {
        throw "dotnet publish failed with exit code $LASTEXITCODE."
    }
}
else {
    if (-not (Test-Path -LiteralPath $publishedAppPath -PathType Container)) {
        throw "SkipPublish was set, but the staged app folder does not exist: $publishedAppPath"
    }
    New-Item -ItemType Directory -Force -Path $outputRootFull | Out-Null
}

Copy-Item -LiteralPath (Join-Path $scriptRoot 'install.ps1') -Destination (Join-Path $stagingRoot 'install.ps1') -Force
Copy-Item -LiteralPath (Join-Path $scriptRoot 'uninstall.ps1') -Destination (Join-Path $stagingRoot 'uninstall.ps1') -Force
Copy-Item -LiteralPath (Join-Path $scriptRoot 'README.md') -Destination (Join-Path $stagingRoot 'README.md') -Force

$installNotes = @"
HourWise Tacho Reader Helper
Version: $helperVersion
Runtime: $Runtime
Built: $createdAtUtc

Install for the current Windows user:

    Set-ExecutionPolicy -Scope Process Bypass -Force
    .\install.ps1 -Scope CurrentUser

Start manually after install:

    & "`$env:LOCALAPPDATA\Programs\HourWise\TachoReaderHelper\Start-HourWiseTachoReaderHelper.ps1"

Validate:

    Invoke-RestMethod http://127.0.0.1:47231/status
    Invoke-RestMethod http://127.0.0.1:47231/diagnostics

Machine-wide install requires an elevated PowerShell session:

    .\install.ps1 -Scope Machine

Uninstall:

    .\uninstall.ps1 -Scope CurrentUser
"@
Set-Content -LiteralPath (Join-Path $stagingRoot 'START_HERE.txt') -Value $installNotes -Encoding UTF8

$packageManifest = [ordered]@{
    name = 'HourWise.TachoReaderHelper'
    helperVersion = $helperVersion
    runtime = $Runtime
    configuration = $Configuration
    selfContained = -not $FrameworkDependent
    createdAtUtc = $createdAtUtc
    defaultEndpoint = 'http://127.0.0.1:47231'
    installScript = 'install.ps1'
    uninstallScript = 'uninstall.ps1'
    appPath = 'app'
}
$packageManifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stagingRoot 'package-manifest.json') -Encoding UTF8

$signingCertificate = $null
if (-not [string]::IsNullOrWhiteSpace($CertificateThumbprint)) {
    $signingCertificate = Get-SigningCertificate $CertificateThumbprint
    $filesToSign = Get-ChildItem -LiteralPath $stagingRoot -Recurse -File |
        Where-Object { $_.Extension -in '.exe', '.dll', '.ps1' }

    foreach ($file in $filesToSign) {
        Invoke-AuthenticodeSign -Path $file.FullName -Certificate $signingCertificate
    }
}

if (Test-Path -LiteralPath $versionedZipPath) {
    Remove-Item -LiteralPath $versionedZipPath -Force
}
if (Test-Path -LiteralPath $latestZipPath) {
    Remove-Item -LiteralPath $latestZipPath -Force
}

Compress-Archive -Path (Join-Path $stagingRoot '*') -DestinationPath $versionedZipPath -Force
Copy-Item -LiteralPath $versionedZipPath -Destination $latestZipPath -Force

$versionedHash = (Get-FileHash -LiteralPath $versionedZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$latestHash = (Get-FileHash -LiteralPath $latestZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$latestInfo = Get-Item -LiteralPath $latestZipPath

$downloadManifest = [ordered]@{
    name = 'HourWise Tacho Reader Helper'
    helperVersion = $helperVersion
    runtime = $Runtime
    configuration = $Configuration
    selfContained = -not $FrameworkDependent
    signed = $null -ne $signingCertificate
    signedWithThumbprint = if ($null -ne $signingCertificate) { $signingCertificate.Thumbprint } else { $null }
    createdAtUtc = $createdAtUtc
    packageFile = $latestInfo.Name
    packageBytes = $latestInfo.Length
    sha256 = $latestHash
    downloadPath = "/downloads/tacho-reader-helper/$($latestInfo.Name)"
    versionedPackageFile = Split-Path -Leaf $versionedZipPath
    versionedSha256 = $versionedHash
    defaultEndpoint = 'http://127.0.0.1:47231'
    installCommand = '.\install.ps1 -Scope CurrentUser'
    manualStartCommand = '& "$env:LOCALAPPDATA\Programs\HourWise\TachoReaderHelper\Start-HourWiseTachoReaderHelper.ps1"'
}
$downloadManifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputRootFull 'latest.json') -Encoding UTF8
$latestHash | Set-Content -LiteralPath (Join-Path $outputRootFull "$($latestInfo.Name).sha256") -Encoding ASCII

Write-Host "Created portal helper package:"
Write-Host "  $latestZipPath"
Write-Host "  SHA256: $latestHash"
Write-Host "  Manifest: $(Join-Path $outputRootFull 'latest.json')"
