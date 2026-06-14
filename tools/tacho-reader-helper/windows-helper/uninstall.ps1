[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('CurrentUser', 'Machine')]
    [string]$Scope = 'CurrentUser',

    [string]$InstallRoot,
    [switch]$RemoveData,
    [switch]$KeepInstallFiles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$helperName = 'HourWise.TachoReaderHelper'
$startupName = 'HourWiseTachoReaderHelper'

function Assert-AdminForMachineScope {
    if ($Scope -ne 'Machine') { return }

    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Machine scope requires an elevated PowerShell session. Use -Scope CurrentUser for a non-admin uninstall.'
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

Assert-AdminForMachineScope
if ([string]::IsNullOrWhiteSpace($InstallRoot)) { $InstallRoot = Get-DefaultInstallRoot }

$installRootFull = [IO.Path]::GetFullPath($InstallRoot)
$installInfoPath = Join-Path $installRootFull 'install-info.json'
$dataRoot = $null
$exePath = $null
$dllPath = $null

if (Test-Path -LiteralPath $installInfoPath) {
    $info = Get-Content -LiteralPath $installInfoPath -Raw | ConvertFrom-Json
    $dataRoot = $info.dataRoot
    $exePath = $info.executable
}
else {
    $defaultDataBase = if ($Scope -eq 'Machine') {
        [Environment]::GetFolderPath([Environment+SpecialFolder]::CommonApplicationData)
    }
    else {
        [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
    }
    $dataRoot = Join-Path $defaultDataBase 'HourWise\TachoReaderHelper'
}

$runKey = if ($Scope -eq 'Machine') {
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run'
}
else {
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
}

if ($PSCmdlet.ShouldProcess($startupName, 'Remove startup registration')) {
    if (Test-Path -Path $runKey) {
        Remove-ItemProperty -Path $runKey -Name $startupName -ErrorAction SilentlyContinue
    }
}

if (-not [string]::IsNullOrWhiteSpace($exePath)) {
    $resolvedExePath = [IO.Path]::GetFullPath($exePath)
    Get-Process -ErrorAction SilentlyContinue | Where-Object {
        try {
            $_.Path -and ([IO.Path]::GetFullPath($_.Path) -eq $resolvedExePath)
        }
        catch {
            $false
        }
    } | ForEach-Object {
        if ($PSCmdlet.ShouldProcess($_.Id, 'Stop installed helper process')) {
            Stop-Process -Id $_.Id -Force
        }
    }
}
else {
    Get-Process -Name $helperName -ErrorAction SilentlyContinue | ForEach-Object {
        if ($PSCmdlet.ShouldProcess($_.Id, 'Stop helper process')) {
            Stop-Process -Id $_.Id -Force
        }
    }
}

if (-not $KeepInstallFiles -and (Test-Path -LiteralPath $installRootFull)) {
    if ($PSCmdlet.ShouldProcess($installRootFull, 'Remove installed helper files')) {
        Remove-Item -LiteralPath $installRootFull -Recurse -Force
    }
}

if ($RemoveData -and -not [string]::IsNullOrWhiteSpace($dataRoot) -and (Test-Path -LiteralPath $dataRoot)) {
    if ($PSCmdlet.ShouldProcess($dataRoot, 'Remove helper logs and exports')) {
        Remove-Item -LiteralPath $dataRoot -Recurse -Force
    }
}

Write-Host "Uninstalled $helperName startup registration."
if ($KeepInstallFiles) { Write-Host "Install files preserved: $installRootFull" }
if (-not $RemoveData) { Write-Host "Logs/exports preserved: $dataRoot" }
