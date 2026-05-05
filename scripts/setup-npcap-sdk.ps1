#Requires -Version 5.1
<#
.SYNOPSIS
    Download and install the Npcap SDK, then set NPCAP_SDK_DIR.
.DESCRIPTION
    build.rs reads NPCAP_SDK_DIR and emits cargo:rustc-link-search.
    This script prepares a local Windows development environment.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SdkVersion = "1.13"
$SdkUrl = "https://npcap.com/dist/npcap-sdk-$SdkVersion.zip"
$InstallPath = "C:\npcap-sdk"
$EnvVarName = "NPCAP_SDK_DIR"
$ZipPath = Join-Path $env:TEMP "npcap-sdk-$SdkVersion.zip"

function Set-NpcapSdkEnvVar {
    $currentValue = [System.Environment]::GetEnvironmentVariable($EnvVarName, "User")
    if ($currentValue -eq $InstallPath) {
        Write-Host "[INFO] User environment variable $EnvVarName is already set."
        return
    }

    [System.Environment]::SetEnvironmentVariable($EnvVarName, $InstallPath, "User")
    $env:NPCAP_SDK_DIR = $InstallPath
    Write-Host "[INFO] Set user environment variable $EnvVarName to $InstallPath."
}

function Test-NpcapSdkLayout {
    $libPath = Join-Path $InstallPath "Lib\x64"
    if (-not (Test-Path $libPath)) {
        Write-Error "[ERROR] Expected SDK library directory was not found: $libPath"
        exit 1
    }
}

function Main {
    if (Test-Path $InstallPath) {
        Write-Host "[INFO] $InstallPath already exists."
        $answer = Read-Host "Overwrite it? (y/N)"
        if ($answer -ne "y") {
            Write-Host "[INFO] Skipped download and extraction."
            Test-NpcapSdkLayout
            Set-NpcapSdkEnvVar
            return
        }

        Remove-Item -Recurse -Force $InstallPath
        Write-Host "[INFO] Removed existing directory."
    }

    Write-Host "[INFO] Downloading Npcap SDK $SdkVersion..."
    try {
        Invoke-WebRequest -Uri $SdkUrl -OutFile $ZipPath -UseBasicParsing
    }
    catch {
        Write-Error "[ERROR] Failed to download Npcap SDK: $_"
        exit 1
    }

    if (-not (Test-Path $ZipPath)) {
        Write-Error "[ERROR] ZIP file was not found: $ZipPath"
        exit 1
    }

    Write-Host "[INFO] Extracting to $InstallPath..."
    try {
        Expand-Archive -Path $ZipPath -DestinationPath $InstallPath -Force
    }
    catch {
        Write-Error "[ERROR] Failed to extract Npcap SDK: $_"
        exit 1
    }

    Remove-Item -Force $ZipPath -ErrorAction SilentlyContinue

    Test-NpcapSdkLayout
    Set-NpcapSdkEnvVar

    Write-Host ""
    Write-Host "[SUCCESS] Npcap SDK $SdkVersion setup completed."
    Write-Host "  Install path : $InstallPath"
    Write-Host "  Env var      : $EnvVarName = $InstallPath"
    Write-Host ""
    Write-Host "Open a new terminal if another process needs the updated user environment."
}

Main
