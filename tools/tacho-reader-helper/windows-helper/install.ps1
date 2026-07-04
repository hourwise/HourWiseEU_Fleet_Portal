[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('CurrentUser', 'Machine')]
    [string]$Scope = 'CurrentUser',

    [string]$InstallRoot,
    [string]$DataRoot,
    [int]$Port = 47231,
    [ValidateSet('127.0.0.1', 'localhost')]
    [string]$HostName = '127.0.0.1',
    [string]$ExportCommand,
    [string]$ExportArguments,
    [int]$ExportTimeoutSeconds = 120,
    [switch]$EnableVuWorkflow,
    [switch]$CompleteAfterRegister,
    [switch]$SimulateCardPresent,
    [switch]$PlaceholderReader,
    [switch]$NoStartup,
    [switch]$NoPublish,
    [string]$PublishedAppPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$helperName = 'HourWise.TachoReaderHelper'
$startupName = 'HourWiseTachoReaderHelper'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Join-Path $scriptRoot 'HourWise.TachoReaderHelper.csproj'
$bundledAppPath = Join-Path $scriptRoot 'app'

function Assert-AdminForMachineScope {
    if ($Scope -ne 'Machine') { return }

    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Machine scope requires an elevated PowerShell session. Use -Scope CurrentUser for a non-admin install.'
    }
}

function Get-DefaultInstallRoot {
    if ($Scope -eq 'Machine') {
        $base = ${env:ProgramFiles}
        if ([string]::IsNullOrWhiteSpace($base)) { $base = 'C:\Program Files' }
        return Join-Path $base 'HourWise\TachoReaderHelper'
    }

    $base = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
    return Join-Path $base 'Programs\HourWise\TachoReaderHelper'
}

function Get-DefaultDataRoot {
    if ($Scope -eq 'Machine') {
        $base = [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonApplicationData)
        return Join-Path $base 'HourWise\TachoReaderHelper'
    }

    $base = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
    return Join-Path $base 'HourWise\TachoReaderHelper'
}

function Get-HelperVersion {
    $programPath = Join-Path $scriptRoot 'Program.cs'
    if (-not (Test-Path -LiteralPath $programPath)) { return 'unknown' }

    $match = Select-String -LiteralPath $programPath -Pattern 'public const string Version = "([^"]+)"' | Select-Object -First 1
    if ($null -eq $match) { return 'unknown' }
    return $match.Matches[0].Groups[1].Value
}

function Quote-ForCommand([string]$Value) {
    return '"' + ($Value -replace '"', '\"') + '"'
}

function Quote-ForPowerShellSingleQuotedString([string]$Value) {
    return "'" + ($Value -replace "'", "''") + "'"
}

Assert-AdminForMachineScope

if ([string]::IsNullOrWhiteSpace($InstallRoot)) { $InstallRoot = Get-DefaultInstallRoot }
if ([string]::IsNullOrWhiteSpace($DataRoot)) { $DataRoot = Get-DefaultDataRoot }
if (-not $NoPublish -and -not (Test-Path -LiteralPath $projectPath) -and (Test-Path -LiteralPath $bundledAppPath -PathType Container)) {
    $NoPublish = $true
    $PublishedAppPath = $bundledAppPath
}

$installRootFull = [IO.Path]::GetFullPath($InstallRoot)
$dataRootFull = [IO.Path]::GetFullPath($DataRoot)
$appRoot = Join-Path $installRootFull 'app'
$logsRoot = Join-Path $dataRootFull 'logs'
$exportsRoot = Join-Path $dataRootFull 'exports'
$startScriptPath = Join-Path $installRootFull 'Start-HourWiseTachoReaderHelper.ps1'
$installInfoPath = Join-Path $installRootFull 'install-info.json'
$versionPath = Join-Path $installRootFull 'VERSION.txt'
$helperVersion = Get-HelperVersion

if ($NoPublish -and [string]::IsNullOrWhiteSpace($PublishedAppPath)) {
    throw '-NoPublish requires -PublishedAppPath pointing to an existing published helper folder.'
}

if ($PSCmdlet.ShouldProcess($installRootFull, 'Install HourWise Tacho Reader Helper')) {
    New-Item -ItemType Directory -Force -Path $installRootFull, $appRoot, $logsRoot, $exportsRoot | Out-Null

    if ($NoPublish) {
        $publishedFull = [IO.Path]::GetFullPath($PublishedAppPath)
        if (-not (Test-Path -LiteralPath $publishedFull -PathType Container)) {
            throw "PublishedAppPath does not exist: $publishedFull"
        }
        Get-ChildItem -LiteralPath $publishedFull -Force | Copy-Item -Destination $appRoot -Recurse -Force
    }
    else {
        if (-not (Test-Path -LiteralPath $projectPath)) {
            throw "Helper project file not found: $projectPath"
        }
        & dotnet publish $projectPath --configuration Release --output $appRoot
        if ($LASTEXITCODE -ne 0) {
            throw "dotnet publish failed with exit code $LASTEXITCODE."
        }
    }

    $exePath = Join-Path $appRoot "$helperName.exe"
    $dllPath = Join-Path $appRoot "$helperName.dll"
    if (-not (Test-Path -LiteralPath $exePath) -and -not (Test-Path -LiteralPath $dllPath)) {
        throw "Published helper output did not contain $helperName.exe or $helperName.dll in $appRoot."
    }

    $runLine = if (Test-Path -LiteralPath $exePath) {
        '& ' + (Quote-ForCommand $exePath)
    }
    else {
        '& dotnet ' + (Quote-ForCommand $dllPath)
    }

    $startScript = @"
`$ErrorActionPreference = 'Stop'
`$env:TACHO_HELPER_HOST = $(Quote-ForPowerShellSingleQuotedString $HostName)
`$env:TACHO_HELPER_PORT = $(Quote-ForPowerShellSingleQuotedString ([string]$Port))
`$env:TACHO_HELPER_LOG_DIR = $(Quote-ForPowerShellSingleQuotedString $logsRoot)
`$env:TACHO_HELPER_EXPORT_OUTPUT_DIR = $(Quote-ForPowerShellSingleQuotedString $exportsRoot)
`$env:TACHO_HELPER_EXPORT_TIMEOUT_SECONDS = $(Quote-ForPowerShellSingleQuotedString ([string]$ExportTimeoutSeconds))
"@

    if (-not [string]::IsNullOrWhiteSpace($ExportCommand)) {
        $startScript += "`n`$env:TACHO_HELPER_EXPORT_COMMAND = $(Quote-ForPowerShellSingleQuotedString $ExportCommand)"
    }
    if (-not [string]::IsNullOrWhiteSpace($ExportArguments)) {
        $startScript += "`n`$env:TACHO_HELPER_EXPORT_ARGS = $(Quote-ForPowerShellSingleQuotedString $ExportArguments)"
    }
    if ($EnableVuWorkflow) { $startScript += "`n`$env:TACHO_HELPER_ENABLE_VU_WORKFLOW = 'true'" }
    if ($CompleteAfterRegister) { $startScript += "`n`$env:TACHO_HELPER_COMPLETE_AFTER_REGISTER = 'true'" }
    if ($SimulateCardPresent) { $startScript += "`n`$env:TACHO_HELPER_SIMULATE_CARD_PRESENT = 'true'" }
    if ($PlaceholderReader) { $startScript += "`n`$env:TACHO_HELPER_PLACEHOLDER_READER = 'true'" }

    $startScript += @"

Set-Location $(Quote-ForPowerShellSingleQuotedString $appRoot)
$runLine
"@

    Set-Content -LiteralPath $startScriptPath -Value $startScript -Encoding UTF8
    Set-Content -LiteralPath $versionPath -Value $helperVersion -Encoding UTF8

    $startupCommand = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ' + (Quote-ForCommand $startScriptPath)
    if (-not $NoStartup) {
        $runKey = if ($Scope -eq 'Machine') {
            'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run'
        }
        else {
            'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
        }
        New-Item -Path $runKey -Force | Out-Null
        New-ItemProperty -Path $runKey -Name $startupName -Value $startupCommand -PropertyType String -Force | Out-Null
    }

    $installInfo = [ordered]@{
        name = $helperName
        version = $helperVersion
        scope = $Scope
        installedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
        installRoot = $installRootFull
        appRoot = $appRoot
        dataRoot = $dataRootFull
        logsRoot = $logsRoot
        exportsRoot = $exportsRoot
        host = $HostName
        port = $Port
        startupRegistered = -not $NoStartup
        startupName = $startupName
        startScript = $startScriptPath
        executable = if (Test-Path -LiteralPath $exePath) { $exePath } else { $dllPath }
        diagnosticsUrl = "http://$HostName`:$Port/diagnostics"
        statusUrl = "http://$HostName`:$Port/status"
    }
    $installInfo | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $installInfoPath -Encoding UTF8

    Write-Host "Installed $helperName $helperVersion"
    Write-Host "Install root: $installRootFull"
    Write-Host "Logs: $logsRoot"
    Write-Host "Exports: $exportsRoot"
    Write-Host "Startup registered: $(-not $NoStartup)"
    Write-Host "Status URL: http://$HostName`:$Port/status"
}
